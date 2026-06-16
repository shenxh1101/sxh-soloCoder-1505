import { create } from 'zustand';
import type {
  Ingredient,
  Product,
  SaleRecord,
  RestockRecord,
  ProductCategory,
  RecipeItem,
  ProductCostDetail,
} from '@/types';
import {
  mockIngredients,
  mockProducts,
  mockSaleRecords,
  mockRestockRecords,
} from '@/data/mock';
import {
  generateId,
  calculateProductCost,
  roundTo,
} from '@/utils';

interface AppState {
  ingredients: Ingredient[];
  products: Product[];
  saleRecords: SaleRecord[];
  restockRecords: RestockRecord[];

  addIngredient: (data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateIngredient: (id: string, data: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;
  restockIngredient: (id: string, amount: number, totalPrice: number) => void;
  getIngredientById: (id: string) => Ingredient | undefined;

  addProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (category: ProductCategory | 'all') => Product[];
  getProductCost: (productId: string) => { totalCost: number; details: ProductCostDetail[] };

  makeSale: (productId: string, quantity?: number) => { success: boolean; message: string; record?: SaleRecord };
  canMakeProduct: (productId: string) => { canMake: boolean; minServings: number; limitingName?: string };

  getTodayStats: () => {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    orderCount: number;
    totalCups: number;
  };
  getProductRank: (sortBy: 'quantity' | 'profit') => Array<{
    productId: string;
    productName: string;
    category: ProductCategory;
    quantity: number;
    totalRevenue: number;
    totalProfit: number;
    unitProfit: number;
  }>;
  getCategoryStats: () => Array<{
    category: ProductCategory;
    quantity: number;
    totalRevenue: number;
  }>;
  getWarningIngredients: () => Ingredient[];
}

export const useAppStore = create<AppState>((set, get) => ({
  ingredients: [...mockIngredients],
  products: [...mockProducts],
  saleRecords: [...mockSaleRecords],
  restockRecords: [...mockRestockRecords],

  addIngredient: (data) => {
    const now = Date.now();
    const newItem: Ingredient = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ ingredients: [...state.ingredients, newItem] }));
    console.log('[Store] addIngredient', newItem);
  },

  updateIngredient: (id, data) => {
    set((state) => ({
      ingredients: state.ingredients.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
      ),
    }));
    console.log('[Store] updateIngredient', id, data);
  },

  deleteIngredient: (id) => {
    set((state) => ({
      ingredients: state.ingredients.filter((item) => item.id !== id),
    }));
    console.log('[Store] deleteIngredient', id);
  },

  restockIngredient: (id, amount, totalPrice) => {
    const { ingredients, restockRecords } = get();
    const ingredient = ingredients.find((i) => i.id === id);
    if (!ingredient) return;

    const now = Date.now();
    const record: RestockRecord = {
      id: generateId(),
      ingredientId: id,
      ingredientName: ingredient.name,
      amount,
      unit: ingredient.unit,
      totalPrice,
      createdAt: now,
    };

    set((state) => ({
      ingredients: state.ingredients.map((item) =>
        item.id === id
          ? { ...item, stock: item.stock + amount, updatedAt: now }
          : item
      ),
      restockRecords: [record, ...state.restockRecords],
    }));
    console.log('[Store] restockIngredient', id, amount, totalPrice);
  },

  getIngredientById: (id) => {
    return get().ingredients.find((i) => i.id === id);
  },

  addProduct: (data) => {
    const now = Date.now();
    const newItem: Product = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ products: [...state.products, newItem] }));
    console.log('[Store] addProduct', newItem);
  },

  updateProduct: (id, data) => {
    set((state) => ({
      products: state.products.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
      ),
    }));
    console.log('[Store] updateProduct', id, data);
  },

  deleteProduct: (id) => {
    set((state) => ({
      products: state.products.filter((item) => item.id !== id),
    }));
    console.log('[Store] deleteProduct', id);
  },

  getProductById: (id) => {
    return get().products.find((p) => p.id === id);
  },

  getProductsByCategory: (category) => {
    const { products } = get();
    if (category === 'all') return products;
    return products.filter((p) => p.category === category);
  },

  getProductCost: (productId) => {
    const { products, ingredients } = get();
    const product = products.find((p) => p.id === productId);
    if (!product) return { totalCost: 0, details: [] };
    return calculateProductCost(product, ingredients);
  },

  makeSale: (productId, quantity = 1) => {
    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return { success: false, message: '产品不存在' };

    for (const item of product.recipe) {
      const ingredient = state.ingredients.find((i) => i.id === item.ingredientId);
      if (!ingredient) {
        return { success: false, message: `原料缺失，无法制作` };
      }
      if (ingredient.stock < item.amount * quantity) {
        return { success: false, message: `${ingredient.name}库存不足` };
      }
    }

    const { totalCost } = calculateProductCost(product, state.ingredients);
    const unitCost = roundTo(totalCost, 2);
    const totalCostAll = roundTo(unitCost * quantity, 2);
    const totalRevenue = roundTo(product.sellingPrice * quantity, 2);
    const totalProfit = roundTo(totalRevenue - totalCostAll, 2);

    const now = Date.now();
    const record: SaleRecord = {
      id: generateId(),
      productId,
      productName: product.name,
      quantity,
      unitCost,
      sellingPrice: product.sellingPrice,
      totalCost: totalCostAll,
      totalRevenue,
      totalProfit,
      createdAt: now,
    };

    const newIngredients = state.ingredients.map((ing) => {
      const recipeItem = product.recipe.find((r) => r.ingredientId === ing.id);
      if (recipeItem) {
        return {
          ...ing,
          stock: ing.stock - recipeItem.amount * quantity,
          updatedAt: now,
        };
      }
      return ing;
    });

    set({
      ingredients: newIngredients,
      saleRecords: [record, ...state.saleRecords],
    });
    console.log('[Store] makeSale', record);
    return { success: true, message: `成功售出${quantity}杯${product.name}`, record };
  },

  canMakeProduct: (productId) => {
    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return { canMake: false, minServings: 0 };

    let minServings = Infinity;
    let limitingName: string | undefined;

    for (const item of product.recipe) {
      const ingredient = state.ingredients.find((i) => i.id === item.ingredientId);
      if (!ingredient || ingredient.stock <= 0) {
        return { canMake: false, minServings: 0, limitingName: ingredient?.name || '未知原料' };
      }
      const canMake = Math.floor(ingredient.stock / item.amount);
      if (canMake < minServings) {
        minServings = canMake;
        limitingName = ingredient.name;
      }
    }

    return {
      canMake: minServings >= 1,
      minServings: minServings === Infinity ? 0 : minServings,
      limitingName,
    };
  },

  getTodayStats: () => {
    const { saleRecords } = get();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const todayRecords = saleRecords.filter((r) => r.createdAt >= todayStart);
    let totalRevenue = 0;
    let totalCost = 0;
    let totalCups = 0;

    todayRecords.forEach((r) => {
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalCups += r.quantity;
    });

    return {
      totalRevenue: roundTo(totalRevenue, 2),
      totalCost: roundTo(totalCost, 2),
      totalProfit: roundTo(totalRevenue - totalCost, 2),
      orderCount: todayRecords.length,
      totalCups,
    };
  },

  getProductRank: (sortBy = 'quantity') => {
    const { saleRecords, products } = get();
    const map = new Map<
      string,
      {
        productName: string;
        category: ProductCategory;
        quantity: number;
        totalRevenue: number;
        totalProfit: number;
      }
    >();

    saleRecords.forEach((r) => {
      const product = products.find((p) => p.id === r.productId);
      if (!product) return;
      const existing = map.get(r.productId);
      if (existing) {
        existing.quantity += r.quantity;
        existing.totalRevenue += r.totalRevenue;
        existing.totalProfit += r.totalProfit;
      } else {
        map.set(r.productId, {
          productName: r.productName,
          category: product.category,
          quantity: r.quantity,
          totalRevenue: r.totalRevenue,
          totalProfit: r.totalProfit,
        });
      }
    });

    const list = Array.from(map.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      category: data.category,
      quantity: data.quantity,
      totalRevenue: roundTo(data.totalRevenue, 2),
      totalProfit: roundTo(data.totalProfit, 2),
      unitProfit: data.quantity > 0 ? roundTo(data.totalProfit / data.quantity, 2) : 0,
    }));

    if (sortBy === 'quantity') {
      list.sort((a, b) => b.quantity - a.quantity);
    } else {
      list.sort((a, b) => b.totalProfit - a.totalProfit);
    }

    return list;
  },

  getCategoryStats: () => {
    const { saleRecords, products } = get();
    const map = new Map<
      ProductCategory,
      { quantity: number; totalRevenue: number }
    >();

    saleRecords.forEach((r) => {
      const product = products.find((p) => p.id === r.productId);
      if (!product) return;
      const existing = map.get(product.category);
      if (existing) {
        existing.quantity += r.quantity;
        existing.totalRevenue += r.totalRevenue;
      } else {
        map.set(product.category, {
          quantity: r.quantity,
          totalRevenue: r.totalRevenue,
        });
      }
    });

    return Array.from(map.entries()).map(([category, data]) => ({
      category,
      quantity: data.quantity,
      totalRevenue: roundTo(data.totalRevenue, 2),
    }));
  },

  getWarningIngredients: () => {
    const { ingredients } = get();
    return ingredients.filter((i) => i.stock <= i.warningThreshold);
  },
}));
