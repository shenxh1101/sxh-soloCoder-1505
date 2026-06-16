import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useAppStore } from '@/store';
import { categoryLabels, categoryColors, formatPrice, roundTo, getStockStatus } from '@/utils';
import styles from './index.module.scss';

const categoryIconMap: Record<string, string> = {
  milk_tea: '🧋',
  fruit_tea: '🍹',
  coffee: '☕',
};

const categoryColorMap: Record<string, { bg: string; color: string }> = {
  乳制品: { bg: 'rgba(255,255,200,0.4)', color: '#F5A623' },
  茶底: { bg: 'rgba(126,211,33,0.15)', color: '#7ED321' },
  糖浆: { bg: 'rgba(245,166,35,0.15)', color: '#F5A623' },
  配料: { bg: 'rgba(255,107,157,0.15)', color: '#FF6B9D' },
  水果: { bg: 'rgba(255,138,80,0.15)', color: '#FF8A50' },
  咖啡: { bg: 'rgba(101,67,33,0.15)', color: '#654321' },
  其他: { bg: 'rgba(160,154,148,0.15)', color: '#A09A94' },
};

const ProductDetailPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id as string;

  const getProductById = useAppStore((s) => s.getProductById);
  const getProductCost = useAppStore((s) => s.getProductCost);
  const canMakeProduct = useAppStore((s) => s.canMakeProduct);
  const makeSale = useAppStore((s) => s.makeSale);
  const getIngredientById = useAppStore((s) => s.getIngredientById);

  const product = useMemo(() => (productId ? getProductById(productId) : undefined), [productId, getProductById]);
  const costInfo = useMemo(() => (product ? getProductCost(product.id) : { totalCost: 0, details: [] }), [product, getProductCost]);
  const makeInfo = useMemo(() => (product ? canMakeProduct(product.id) : { canMake: false, minServings: 0, limitingName: '' }), [product, canMakeProduct]);

  const profit = product ? roundTo(product.sellingPrice - costInfo.totalCost, 2) : 0;
  const profitRate = product && product.sellingPrice > 0 ? roundTo((profit / product.sellingPrice) * 100, 0) : 0;
  const costRate = costInfo.totalCost > 0 && product ? roundTo((costInfo.totalCost / product.sellingPrice) * 100, 0) : 0;

  if (!product) {
    return (
      <View className="pageContainer" style={{ padding: '80rpx 32rpx', textAlign: 'center', color: '#A09A94' }}>
        产品不存在
      </View>
    );
  }

  const cc = categoryColors[product.category];

  const handleEdit = () => {
    Taro.navigateTo({ url: `/pages/product-edit/index?id=${product.id}` });
  };

  const handleMake = () => {
    if (!makeInfo.canMake) {
      Taro.showToast({
        title: `${makeInfo.limitingName || '原料'}库存不足`,
        icon: 'none',
      });
      return;
    }
    Taro.showModal({
      title: '确认制作',
      content: `制作1杯「${product.name}」？\n成本：${formatPrice(costInfo.totalCost)}  毛利：${formatPrice(profit)}`,
      confirmText: '确认制作',
      cancelText: '取消',
      confirmColor: '#FF8A50',
      success: (res) => {
        if (res.confirm) {
          const r = makeSale(product.id, 1);
          Taro.showToast({ title: r.success ? '制作成功' : r.message, icon: r.success ? 'success' : 'none' });
        }
      },
    });
  };

  return (
    <View>
      <ScrollView scrollY className={`pageContainer ${styles.pageContent}`}>
        {/* 头部卡片 */}
        <View className={styles.headerCard}>
          <View className={styles.catTag}>{categoryIconMap[product.category]} {categoryLabels[product.category]}</View>
          <Text className={styles.pName}>{product.name}</Text>
          {product.description && <Text className={styles.pDesc}>{product.description}</Text>}
          <View className={styles.priceRow}>
            <View className={styles.priceItem}>
              <Text className={styles.piLabel}>售价</Text>
              <Text className={styles.piValue}>{formatPrice(product.sellingPrice)}</Text>
            </View>
            <View className={styles.priceItem}>
              <Text className={styles.piLabel}>成本</Text>
              <Text className={styles.piValue}>{formatPrice(costInfo.totalCost)}</Text>
            </View>
            <View className={styles.priceItem}>
              <Text className={styles.piLabel}>毛利</Text>
              <Text className={styles.piValue}>{formatPrice(profit)}</Text>
            </View>
          </View>
        </View>

        {/* 配方清单 */}
        <View className={styles.sectionBlock}>
          <View className={styles.sectionTitle}>
            <Text className={styles.titleText}>📋 配方清单</Text>
            <Text className={styles.countBadge}>共 {product.recipe.length} 种原料</Text>
          </View>
          <View className={styles.recipeList}>
            {costInfo.details.length === 0 ? (
              <View style={{ padding: '48rpx 0', textAlign: 'center', color: '#A09A94', fontSize: '24rpx' }}>
                暂无配方
              </View>
            ) : (
              costInfo.details.map((d) => {
                const ing = getIngredientById(d.ingredientId);
                const cat = ing?.category || '其他';
                const iconStyle = categoryColorMap[cat] || categoryColorMap['其他'];
                const stockStatus = ing ? getStockStatus(ing.stock, ing.warningThreshold) : 'safe';
                return (
                  <View key={d.ingredientId} className={styles.recipeItem}>
                    <View className={styles.riIcon} style={{ background: iconStyle.bg }}>
                      {categoryColorMap[cat] ? (cat === '乳制品' ? '🥛' : cat === '茶底' ? '🍵' : cat === '糖浆' ? '🍯' : cat === '配料' ? '🧋' : cat === '水果' ? '🍓' : cat === '咖啡' ? '☕' : '📦') : '📦'}
                    </View>
                    <View className={styles.riInfo}>
                      <Text className={styles.riName}>{d.ingredientName}</Text>
                      <Text className={styles.riUnit}>
                        {formatPrice(d.unitPrice)} / {d.unit}
                        {ing && stockStatus !== 'safe' && ` · 库存${ing.stock}${ing.unit}`}
                      </Text>
                    </View>
                    <View className={styles.riAmount}>
                      <Text className={styles.num}>{d.amount}</Text>
                      <Text className={styles.unit}>{d.unit}</Text>
                    </View>
                    <Text className={styles.riCost}>{formatPrice(d.itemCost)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* 成本分析 */}
        <View className={styles.sectionBlock}>
          <View className={styles.sectionTitle}>
            <Text className={styles.titleText}>💰 成本分析</Text>
          </View>
          <View className={styles.costSummary}>
            <View className={styles.summaryRow}>
              <Text className={styles.sLabel}>物料成本</Text>
              <Text className={`${styles.sValue} ${styles.cost}`}>{formatPrice(costInfo.totalCost)}</Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.sLabel}>成本率</Text>
              <Text className={`${styles.sValue} ${styles.rate}`}>{costRate}%</Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.sLabel}>售价</Text>
              <Text className={`${styles.sValue} ${styles.price}`}>{formatPrice(product.sellingPrice)}</Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.sLabel}>毛利率</Text>
              <Text className={`${styles.sValue} ${styles.rate}`}>{profitRate}%</Text>
            </View>
            <View className={styles.summaryRow} style={{ paddingTop: '16rpx' }}>
              <Text className={styles.sLabel}>单杯毛利</Text>
              <Text className={`${styles.sBig} ${styles.profit}`}>{formatPrice(profit)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        <View className={`${styles.btn} ${styles.edit}`} onClick={handleEdit}>
          ✏️ 编辑配方
        </View>
        <View className={`${styles.btn} ${styles.make}`} onClick={handleMake}>
          🧋 制作一杯
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
