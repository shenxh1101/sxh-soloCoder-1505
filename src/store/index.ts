import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Taro from '@tarojs/taro';
import type {
  Ingredient,
  Product,
  SaleRecord,
  RestockRecord,
  StockLog,
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

const STORAGE_KEY = 'cold_drink_shop_store';

const taroStorage = {
  getItem: (name: string): string | null => {
    try {
      const val = Taro.getStorageSync(name);
      return val === '' || val === undefined || val === null ? null : String(val);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      Taro.setStorageSync(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name: string): void => {
    try {
      Taro.removeStorageSync(name);
    } catch {
      // ignore
    }
  },
};

interface AppState {
  ingredients: Ingredient[];
  products: Product[];
  saleRecords: SaleRecord[];
  restockRecords: RestockRecord[];
  stockLogs: StockLog[];

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
  getStatsByRange: (start: number, end: number) => {
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

  resetToDefault: () => void;
}

const createStore = (set, get) => ({
  ingredients: [...mockIngredients],
  products: [...mockProducts],
  saleRecords: [...mockSaleRecords],
  restockRecords: [...mockRestockRecords],
  stockLogs: [] as StockLog[],

  addIngredient: (data) => {
    const now = Date.now();
    const newItem: Ingredient = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ ingredients: [...state.ingredients, newItem] }));
  },

  updateIngredient: (id, data) => {
    const { ingredients } = get();
    const old = ingredients.find((i) => i.id === id);
    if (!old) return;
    const now = Date.now();

    const newStock = data.stock !== undefined ? data.stock : old.stock;
    if (data.stock !== undefined && data.stock !== old.stock) {
      const log: StockLog = {
        id: generateId(),
        ingredientId: id,
        ingredientName: data.name || old.name,
        type: 'manual_edit',
        changeAmount: roundTo(data.stock - old.stock, 2),
        stockBefore: old.stock,
        stockAfter: data.stock,
        unit: old.unit,
        source: '手动修改库存',
        createdAt: now,
      };
      set((state) => ({
        ingredients: state.ingredients.map((item) =>
          item.id === id ? { ...item, ...data, updatedAt: now } : item
        ),
        stockLogs: [log, ...state.stockLogs],
      }));
    } else {
      set((state) => ({
        ingredients: state.ingredients.map((item) =>
          item.id === id ? { ...item, ...data, updatedAt: now } : item
        ),
      }));
    }
  },

  deleteIngredient: (id) => {
    set((state) => ({
      ingredients: state.ingredients.filter((item) => item.id !== id),
    }));
  },

  restockIngredient: (id, amount, totalPrice) => {
    const { ingredients } = get();
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
    const log: StockLog = {
      id: generateId(),
      ingredientId: id,
      ingredientName: ingredient.name,
      type: 'restock',
      changeAmount: amount,
      stockBefore: ingredient.stock,
      stockAfter: ingredient.stock + amount,
      unit: ingredient.unit,
      source: `补货 +${amount}${ingredient.unit}`,
      createdAt: now,
    };

    set((state) => ({
      ingredients: state.ingredients.map((item) =>
        item.id === id
          ? { ...item, stock: item.stock + amount, updatedAt: now }
          : item
      ),
      restockRecords: [record, ...state.restockRecords],
      stockLogs: [log, ...state.stockLogs],
    }));
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
  },

  updateProduct: (id, data) => {
    set((state) => ({
      products: state.products.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
      ),
    }));
  },

  deleteProduct: (id) => {
    set((state) => ({
      products: state.products.filter((item) => item.id !== id),
    }));
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
      type: 'sale',
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

    const newLogs: StockLog[] = product.recipe.map((r) => {
      const ing = state.ingredients.find((i) => i.id === r.ingredientId);
      return {
        id: generateId(),
        ingredientId: r.ingredientId,
        ingredientName: ing?.name || '未知原料',
        type: 'sale_deduct' as const,
        changeAmount: -(r.amount * quantity),
        stockBefore: ing?.stock || 0,
        stockAfter: (ing?.stock || 0) - r.amount * quantity,
        unit: ing?.unit || 'g' as const,
        source: `制作${product.name}×${quantity}`,
        createdAt: now,
      };
    });

    set({
      ingredients: newIngredients,
      saleRecords: [record, ...state.saleRecords],
      stockLogs: [...newLogs, ...state.stockLogs],
    });
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

  getStatsByRange: (start: number, end: number) => {
    const { saleRecords } = get();
    const records = saleRecords.filter((r) => r.createdAt >= start && r.createdAt < end);
    let totalRevenue = 0;
    let totalCost = 0;
    let totalCups = 0;

    records.forEach((r) => {
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalCups += r.quantity;
    });

    return {
      totalRevenue: roundTo(totalRevenue, 2),
      totalCost: roundTo(totalCost, 2),
      totalProfit: roundTo(totalRevenue - totalCost, 2),
      orderCount: records.length,
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
      if (r.type === 'init') return;
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
      if (r.type === 'init') return;
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

  resetToDefault: () => {
    const now = Date.now();
    const initSaleRecord: SaleRecord = {
      id: generateId(),
      productId: 'system_init',
      productName: '🔄 系统初始化',
      quantity: 0,
      unitCost: 0,
      sellingPrice: 0,
      totalCost: 0,
      totalRevenue: 0,
      totalProfit: 0,
      createdAt: now,
      type: 'init',
    };
    const initStockLog: StockLog = {
      id: generateId(),
      ingredientId: 'system_init',
      ingredientName: '🔄 系统初始化',
      type: 'init',
      changeAmount: 0,
      stockBefore: 0,
      stockAfter: 0,
      unit: 'g',
      source: '已恢复为默认演示数据',
      createdAt: now,
    };
    set({
      ingredients: [...mockIngredients],
      products: [...mockProducts],
      saleRecords: [initSaleRecord, ...mockSaleRecords],
      restockRecords: [...mockRestockRecords],
      stockLogs: [initStockLog],
    });
  },
});

export const useAppStore = create<AppState>()(
  persist(
    createStore,
    {
      name: STORAGE_KEY,
      storage: taroStorage,
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...(persistedState as object),
            stockLogs: [],
          };
        }
        if (version < 3) {
          return undefined;
        }
        return persistedState;
      },
    }
  )
);
