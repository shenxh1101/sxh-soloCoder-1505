// 原料计量单位
export type UnitType = 'g' | 'ml';

// 产品分类
export type ProductCategory = 'milk_tea' | 'fruit_tea' | 'coffee';

// 原料库存状态
export type StockStatus = 'safe' | 'warning' | 'critical';

// 原料
export interface Ingredient {
  id: string;
  name: string;
  unit: UnitType;
  pricePerUnit: number;
  stock: number;
  warningThreshold: number;
  category: string;
  createdAt: number;
  updatedAt: number;
}

// 配方项
export interface RecipeItem {
  ingredientId: string;
  amount: number;
}

// 产品
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sellingPrice: number;
  recipe: RecipeItem[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// 销售记录
export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  createdAt: number;
}

// 补货记录
export interface RestockRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  amount: number;
  unit: UnitType;
  totalPrice: number;
  createdAt: number;
}

// 库存流水
export type StockLogType = 'restock' | 'sale_deduct' | 'manual_edit' | 'adjust' | 'init';

export interface StockLog {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: StockLogType;
  changeAmount: number;
  stockBefore: number;
  stockAfter: number;
  unit: UnitType;
  source: string;
  createdAt: number;
}

// 销售记录
export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  createdAt: number;
  type?: 'sale' | 'init';
}
export interface ProductCostDetail {
  ingredientId: string;
  ingredientName: string;
  amount: number;
  unit: UnitType;
  unitPrice: number;
  itemCost: number;
}

// 统计概览
export interface DailyStats {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  orderCount: number;
}

// 产品排行项
export interface ProductRankItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  totalRevenue: number;
  totalProfit: number;
  unitProfit: number;
}
