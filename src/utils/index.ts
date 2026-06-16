import type { Product, Ingredient, RecipeItem, ProductCostDetail, StockStatus } from '@/types';

// 生成唯一ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// 计算单个配方项成本
export const calculateRecipeItemCost = (
  ingredient: Ingredient,
  amount: number
): number => {
  return Number((ingredient.pricePerUnit * amount).toFixed(4));
};

// 计算产品总成本
export const calculateProductCost = (
  product: Product,
  ingredients: Ingredient[]
): { totalCost: number; details: ProductCostDetail[] } => {
  const details: ProductCostDetail[] = [];
  let totalCost = 0;

  product.recipe.forEach((item: RecipeItem) => {
    const ingredient = ingredients.find((i) => i.id === item.ingredientId);
    if (ingredient) {
      const itemCost = calculateRecipeItemCost(ingredient, item.amount);
      totalCost += itemCost;
      details.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        amount: item.amount,
        unit: ingredient.unit,
        unitPrice: ingredient.pricePerUnit,
        itemCost: Number(itemCost.toFixed(4)),
      });
    }
  });

  return {
    totalCost: Number(totalCost.toFixed(4)),
    details,
  };
};

// 计算建议售价（成本倍率，默认3倍即毛利率约66%）
export const calculateSuggestedPrice = (
  cost: number,
  profitRate: number = 0.66
): number => {
  if (cost <= 0) return 0;
  const suggested = cost / (1 - profitRate);
  return Math.round(suggested * 10) / 10;
};

// 获取库存状态
export const getStockStatus = (stock: number, threshold: number): StockStatus => {
  if (stock <= 0) return 'critical';
  if (stock <= threshold) return 'warning';
  return 'safe';
};

// 计算原料还能做几份（根据某个产品配方）
export const calculateServingsLeft = (
  ingredient: Ingredient,
  amountPerServing: number
): number => {
  if (amountPerServing <= 0) return Infinity;
  return Math.floor(ingredient.stock / amountPerServing);
};

// 检查是否有足够库存制作产品
export const checkStockAvailable = (
  product: Product,
  ingredients: Ingredient[]
): { available: boolean; minServings: number; limitingIngredient?: Ingredient } => {
  let minServings = Infinity;
  let limitingIngredient: Ingredient | undefined;

  for (const item of product.recipe) {
    const ingredient = ingredients.find((i) => i.id === item.ingredientId);
    if (!ingredient) continue;

    const servings = calculateServingsLeft(ingredient, item.amount);
    if (servings < minServings) {
      minServings = servings;
      limitingIngredient = ingredient;
    }
  }

  return {
    available: minServings >= 1,
    minServings: minServings === Infinity ? 0 : minServings,
    limitingIngredient,
  };
};

// 格式化价格显示
export const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`;
};

// 格式化数量+单位
export const formatAmount = (amount: number, unit: string): string => {
  return `${amount}${unit}`;
};

// 分类名称映射
export const categoryLabels: Record<string, string> = {
  milk_tea: '奶茶',
  fruit_tea: '果茶',
  coffee: '咖啡',
};

// 分类颜色映射
export const categoryColors: Record<string, { bg: string; color: string }> = {
  milk_tea: { bg: 'rgba(139, 90, 43, 0.1)', color: '#8B5A2B' },
  fruit_tea: { bg: 'rgba(255, 107, 157, 0.1)', color: '#FF6B9D' },
  coffee: { bg: 'rgba(101, 67, 33, 0.1)', color: '#654321' },
};

// 取今天日期字符串 YYYY-MM-DD
export const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 数字四舍五入到指定小数位
export const roundTo = (num: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};
