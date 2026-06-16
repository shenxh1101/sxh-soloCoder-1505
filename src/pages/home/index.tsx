import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { categoryLabels, categoryColors, formatPrice, roundTo } from '@/utils';
import type { ProductCategory, Product } from '@/types';
import styles from './index.module.scss';

const categories: Array<{ key: ProductCategory | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'milk_tea', label: '奶茶' },
  { key: 'fruit_tea', label: '果茶' },
  { key: 'coffee', label: '咖啡' },
];

const HomePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const products = useAppStore((state) => state.products);
  const ingredients = useAppStore((state) => state.ingredients);
  const makeSale = useAppStore((state) => state.makeSale);

  const todayStats = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const saleRecords = useAppStore.getState().saleRecords;
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
  }, [ingredients, products]);

  const warningList = useMemo(() => ingredients.filter((i) => i.stock <= i.warningThreshold), [ingredients]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const getProductMeta = (product: Product) => {
    let totalCost = 0;
    product.recipe.forEach((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      if (ing) totalCost += ing.pricePerUnit * r.amount;
    });
    totalCost = Number(totalCost.toFixed(4));

    let minServings = Infinity;
    let limitingName: string | undefined;
    let canMake = true;
    for (const r of product.recipe) {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      if (!ing || ing.stock <= 0) {
        canMake = false;
        limitingName = ing?.name || '未知原料';
        minServings = 0;
        break;
      }
      const servings = Math.floor(ing.stock / r.amount);
      if (servings < minServings) {
        minServings = servings;
        limitingName = ing.name;
      }
    }
    if (minServings === Infinity) { minServings = 0; canMake = false; }
    if (minServings < 1) canMake = false;

    const profit = roundTo(product.sellingPrice - totalCost, 2);
    const profitRate = totalCost > 0 ? roundTo((profit / product.sellingPrice) * 100, 0) : 0;

    let stockLevel: 'safe' | 'warning' | 'danger' = 'safe';
    if (!canMake) stockLevel = 'danger';
    else if (minServings <= 5) stockLevel = 'warning';

    return { totalCost, profit, profitRate, canMake, minServings, limitingName, stockLevel };
  };

  const handleMake = (product: Product) => {
    const meta = getProductMeta(product);
    if (!meta.canMake) {
      Taro.showToast({
        title: `${meta.limitingName || '原料'}库存不足`,
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    Taro.showModal({
      title: '确认制作',
      content: `确认制作1杯「${product.name}」？\n物料成本：${formatPrice(meta.totalCost)}\n毛利：${formatPrice(meta.profit)} (${meta.profitRate}%)`,
      confirmText: '确认制作',
      cancelText: '取消',
      confirmColor: '#FF8A50',
      success: (res) => {
        if (res.confirm) {
          const result = makeSale(product.id, 1);
          if (result.success) {
            Taro.showToast({
              title: '制作成功',
              icon: 'success',
              duration: 1500,
            });
          } else {
            Taro.showToast({
              title: result.message,
              icon: 'none',
              duration: 2000,
            });
          }
        }
      },
    });
  };

  const stockTextMap = {
    safe: (n: number) => `库存充足，还可做约${n}杯`,
    warning: (n: number) => `库存偏低，还可做约${n}杯`,
    danger: () => `原料不足，无法制作`,
  };

  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '凌晨好，注意休息';
    if (h < 11) return '早上好，开始营业啦';
    if (h < 14) return '中午好，忙碌时刻';
    if (h < 18) return '下午好，加油干';
    return '晚上好，辛苦了';
  }, []);

  return (
    <ScrollView scrollY className={styles.pageContainer} style={{ height: '100vh' }}>
      {/* 头部统计区 */}
      <View className={styles.header}>
        <Text className={styles.greeting}>{greetingText} 👋</Text>
        <Text className={styles.title}>今天营业怎么样？</Text>
        <View className={styles.statsRow}>
          <View className={styles.statCard}>
            <Text className={styles.statLabel}>今日营收</Text>
            <View>
              <Text className={styles.statValue}>¥{todayStats.totalRevenue}</Text>
            </View>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statLabel}>今日毛利</Text>
            <View>
              <Text className={styles.statValue}>¥{todayStats.totalProfit}</Text>
            </View>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statLabel}>出杯数</Text>
            <View>
              <Text className={styles.statValue}>{todayStats.totalCups}</Text>
              <Text className={styles.statUnit}>杯</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 库存预警区 */}
      {warningList.length > 0 && (
        <View className={styles.warningSection}>
          <View className={classnames('sectionTitle')} style={{ marginBottom: '16rpx' }}>
            <Text>⚠️ 库存预警 ({warningList.length})</Text>
          </View>
          <View className={styles.warningList}>
            {warningList.slice(0, 3).map((item) => (
              <View key={item.id} className={styles.warningItem}>
                <View className={styles.warningLeft}>
                  <View className={styles.warningIcon}>🔔</View>
                  <View className={styles.warningInfo}>
                    <Text className={styles.warningName}>{item.name}</Text>
                    <Text className={styles.warningText}>
                      仅剩 {item.stock}{item.unit}，请尽快补货
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 分类标签 */}
      <ScrollView scrollX className={styles.categoryTabs} enhanced showScrollbar={false}>
        {categories.map((cat) => (
          <View
            key={cat.key}
            className={classnames(styles.tabItem, activeCategory === cat.key && styles.active)}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </View>
        ))}
      </ScrollView>

      {/* 产品列表 */}
      {filteredProducts.length === 0 ? (
        <View className={styles.emptyWrapper}>
          <Text className={styles.emptyText}>该分类暂无产品</Text>
        </View>
      ) : (
        <View className={styles.productList}>
          {filteredProducts.map((product) => {
            const meta = getProductMeta(product);
            const catColor = categoryColors[product.category];
            return (
              <View
                key={product.id}
                className={classnames(styles.productCard, !meta.canMake && styles.disabled)}
              >
                <View className={styles.cardHeader}>
                  <View className={styles.productInfo}>
                    <Text className={styles.productName}>{product.name}</Text>
                    {product.description && (
                      <Text className={styles.productDesc}>{product.description}</Text>
                    )}
                  </View>
                  <View
                    className={styles.categoryTag}
                    style={{ background: catColor.bg, color: catColor.color }}
                  >
                    {categoryLabels[product.category]}
                  </View>
                </View>

                <View className={styles.priceRow}>
                  <View className={styles.priceItem}>
                    <Text className={styles.priceLabel}>售价</Text>
                    <Text className={classnames(styles.priceValue, styles.sellPrice)}>
                      {formatPrice(product.sellingPrice)}
                    </Text>
                  </View>
                  <View className={styles.priceItem}>
                    <Text className={styles.priceLabel}>成本</Text>
                    <Text className={classnames(styles.priceValue, styles.costPrice)}>
                      {formatPrice(meta.totalCost)}
                    </Text>
                  </View>
                  <View className={styles.priceItem}>
                    <Text className={styles.priceLabel}>毛利</Text>
                    <Text className={classnames(styles.priceValue, styles.profitValue)}>
                      {formatPrice(meta.profit)}
                    </Text>
                  </View>
                  <View className={styles.priceItem}>
                    <Text className={styles.priceLabel}>毛利率</Text>
                    <Text className={classnames(styles.priceValue, styles.profitValue)}>
                      {meta.profitRate}%
                    </Text>
                  </View>
                </View>

                <View className={styles.cardFooter}>
                  <Text
                    className={classnames(
                      styles.stockInfo,
                      styles[meta.stockLevel]
                    )}
                  >
                    {stockTextMap[meta.stockLevel](meta.minServings)}
                  </Text>
                  <View
                    className={classnames(styles.makeBtn, !meta.canMake && styles.disabled)}
                    onClick={() => handleMake(product)}
                  >
                    制作一杯
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

export default HomePage;
