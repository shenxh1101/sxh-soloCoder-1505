import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppStore } from '@/store';
import { categoryLabels, categoryColors, formatPrice, roundTo } from '@/utils';
import type { Product, ProductCategory } from '@/types';
import styles from './index.module.scss';

const categoryList: Array<{ key: ProductCategory; label: string; icon: string }> = [
  { key: 'milk_tea', label: '奶茶', icon: '🧋' },
  { key: 'fruit_tea', label: '果茶', icon: '🍹' },
  { key: 'coffee', label: '咖啡', icon: '☕' },
];

const ProductsPage: React.FC = () => {
  const products = useAppStore((state) => state.products);
  const ingredients = useAppStore((state) => state.ingredients);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {
      milk_tea: [],
      fruit_tea: [],
      coffee: [],
    };
    products.forEach((p) => {
      if (groups[p.category]) {
        groups[p.category].push(p);
      }
    });
    return groups;
  }, [products]);

  const getProductCost = (product: Product) => {
    let total = 0;
    product.recipe.forEach((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      if (ing) total += ing.pricePerUnit * r.amount;
    });
    return { totalCost: Number(total.toFixed(4)) };
  };

  const getIngredientName = (id: string) => {
    return ingredients.find((i) => i.id === id)?.name || '未知';
  };

  const handleView = (product: Product) => {
    Taro.navigateTo({ url: `/pages/product-detail/index?id=${product.id}` });
  };

  const handleEdit = (product: Product) => {
    Taro.navigateTo({ url: `/pages/product-edit/index?id=${product.id}` });
  };

  const handleAdd = () => {
    Taro.navigateTo({ url: '/pages/product-edit/index' });
  };

  return (
    <ScrollView scrollY className={styles.pageContainer} style={{ height: '100vh' }}>
      <View className={styles.header}>
        <Text className={styles.title}>产品管理</Text>
        <View className={styles.addBtn} onClick={handleAdd}>
          + 新增产品
        </View>
      </View>

      {products.length === 0 ? (
        <View className={styles.emptyWrapper}>
          <View className={styles.emptyIcon}>🧋</View>
          <Text className={styles.emptyText}>还没有产品，点击右上角新增第一个产品吧</Text>
        </View>
      ) : (
        <View>
          {categoryList.map((cat) => {
            const list = groupedProducts[cat.key] || [];
            if (list.length === 0) return null;
            const catColor = categoryColors[cat.key];

            return (
              <View key={cat.key} className={styles.categorySection}>
                <View className={styles.catHeader}>
                  <Text className={styles.catName}>
                    {cat.icon} {cat.label}
                  </Text>
                  <Text className={styles.catCount}>共 {list.length} 款</Text>
                </View>

                {list.map((product) => {
                  const { totalCost } = getProductCost(product.id);
                  const profit = roundTo(product.sellingPrice - totalCost, 2);
                  const recipeNames = product.recipe
                    .slice(0, 5)
                    .map((r) => getIngredientName(r.ingredientId));

                  return (
                    <View key={product.id} className={styles.productCard}>
                      <View className={styles.cardTop}>
                        <View className={styles.pInfo}>
                          <Text className={styles.pName}>{product.name}</Text>
                          {product.description && (
                            <Text className={styles.pDesc}>{product.description}</Text>
                          )}
                        </View>
                        <View
                          className={styles.pTag}
                          style={{ background: catColor.bg, color: catColor.color }}
                        >
                          {categoryLabels[product.category]}
                        </View>
                      </View>

                      <View className={styles.recipePreview}>
                        <Text className={styles.recipeLabel}>配方：</Text>
                        <View className={styles.recipeList}>
                          {recipeNames.map((name, idx) => (
                            <View key={idx} className={styles.recipeChip}>
                              {name}
                            </View>
                          ))}
                          {product.recipe.length > 5 && (
                            <View className={styles.recipeChip}>
                              +{product.recipe.length - 5}
                            </View>
                          )}
                        </View>
                      </View>

                      <View className={styles.priceRow}>
                        <View className={styles.priceItems}>
                          <View className={styles.pPriceItem}>
                            <Text className={styles.pLabel}>售价</Text>
                            <Text className={`${styles.pValue} ${styles.sell}`}>
                              {formatPrice(product.sellingPrice)}
                            </Text>
                          </View>
                          <View className={styles.pPriceItem}>
                            <Text className={styles.pLabel}>成本</Text>
                            <Text className={`${styles.pValue} ${styles.cost}`}>
                              {formatPrice(totalCost)}
                            </Text>
                          </View>
                          <View className={styles.pPriceItem}>
                            <Text className={styles.pLabel}>毛利</Text>
                            <Text className={`${styles.pValue} ${styles.profit}`}>
                              {formatPrice(profit)}
                            </Text>
                          </View>
                        </View>
                        <View className={styles.pActions}>
                          <View className={styles.viewBtn} onClick={() => handleView(product)}>
                            详情
                          </View>
                          <View className={styles.editBtn} onClick={() => handleEdit(product)}>
                            编辑
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

export default ProductsPage;
