import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { formatPrice, getStockStatus, roundTo } from '@/utils';
import type { Ingredient } from '@/types';
import styles from './index.module.scss';

const categoryIconMap: Record<string, string> = {
  乳制品: '🥛',
  茶底: '🍵',
  糖浆: '🍯',
  配料: '🧋',
  水果: '🍓',
  咖啡: '☕',
  其他: '📦',
};
const categoryColorMap: Record<string, string> = {
  乳制品: '#FFF8E1',
  茶底: '#E8F5E9',
  糖浆: '#FFF3E0',
  配料: '#FCE4EC',
  水果: '#FBE9E7',
  咖啡: '#EFEBE9',
  其他: '#FAFAFA',
};

const statusLabelMap: Record<string, string> = {
  safe: '库存充足',
  warning: '库存偏低',
  critical: '急需补货',
};

const IngredientDetailPage: React.FC = () => {
  const router = useRouter();
  const ingId = router.params.id as string;

  const ingredients = useAppStore((s) => s.ingredients);
  const restockIngredient = useAppStore((s) => s.restockIngredient);
  const restockRecords = useAppStore((s) => s.restockRecords);
  const products = useAppStore((s) => s.products);

  const ingredient = useMemo(() => (ingId ? ingredients.find((i) => i.id === ingId) : undefined), [ingId, ingredients]);

  const stockStatus = ingredient ? getStockStatus(ingredient.stock, ingredient.warningThreshold) : 'safe';
  const stockPercent = ingredient && ingredient.warningThreshold > 0
    ? Math.min(100, Math.round((ingredient.stock / (ingredient.warningThreshold * 3)) * 100))
    : 50;

  const records = useMemo(() => {
    const arr: Array<{
      id: string;
      type: 'in' | 'out';
      title: string;
      time: number;
      amount: number;
      unit: string;
      price?: number;
    }> = [];
    if (!ingredient) return arr;
    restockRecords
      .filter((r) => r.ingredientId === ingredient.id)
      .slice(0, 5)
      .forEach((r) => arr.push({
        id: r.id, type: 'in', title: '补货入库', time: r.createdAt,
        amount: r.amount, unit: r.unit, price: r.totalPrice,
      }));
    return arr.sort((a, b) => b.time - a.time);
  }, [restockRecords, ingredient]);

  const usedInProducts = useMemo(() => {
    if (!ingredient) return [];
    return products.filter((p) => p.recipe.some((r) => r.ingredientId === ingredient.id)).slice(0, 5);
  }, [products, ingredient]);

  const dailyCost = useMemo(() => {
    if (!ingredient) return { cups: 0, perCup: 0 };
    let totalPerDay = 0;
    let minCups = Infinity;
    products.forEach((p) => {
      const item = p.recipe.find((r) => r.ingredientId === ingredient?.id);
      if (item) {
        const cups = Math.floor(ingredient!.stock / item.amount);
        if (cups < minCups) minCups = cups;
        totalPerDay += ingredient!.pricePerUnit * item.amount;
      }
    });
    return { cups: minCups === Infinity ? 0 : minCups, perCup: roundTo(totalPerDay, 4) };
  }, [products, ingredient]);

  if (!ingredient) {
    return (
      <View className="pageContainer" style={{ padding: '80rpx 32rpx', textAlign: 'center', color: '#A09A94' }}>
        原料不存在
      </View>
    );
  }

  const handleRestock = () => {
    const suggest = ingredient.unit === 'ml' ? 1000 : 500;
    Taro.showModal({
      title: `补货 - ${ingredient.name}`,
      editable: true,
      placeholderText: `请输入数量(${ingredient.unit})，建议 ${suggest}`,
      confirmText: '继续',
      cancelText: '取消',
      confirmColor: '#FF8A50',
      success: (res) => {
        if (res.confirm && res.content) {
          const amount = parseFloat(res.content);
          if (isNaN(amount) || amount <= 0) {
            Taro.showToast({ title: '请输入有效数量', icon: 'none' });
            return;
          }
          const totalPrice = roundTo(amount * ingredient.pricePerUnit, 2);
          Taro.showModal({
            title: '确认补货',
            content: `数量：${amount}${ingredient.unit}\n合计：${formatPrice(totalPrice)}`,
            confirmText: '确认',
            confirmColor: '#FF8A50',
            success: (r2) => {
              if (r2.confirm) {
                restockIngredient(ingredient.id, amount, totalPrice);
                Taro.showToast({ title: '补货成功', icon: 'success' });
              }
            },
          });
        }
      },
    });
  };

  const handleEdit = () => {
    Taro.navigateTo({ url: `/pages/ingredient-edit/index?id=${ingredient.id}` });
  };

  const catColor = categoryColorMap[ingredient.category] || '#FAFAFA';

  return (
    <View>
      <ScrollView scrollY className={`pageContainer ${styles.pageContent}`}>
        {/* 头部 */}
        <View className={styles.headerCard}>
          <View className={styles.iconBox} style={{ background: catColor }}>
            {categoryIconMap[ingredient.category] || '📦'}
          </View>
          <View className={styles.infoBox}>
            <Text className={styles.ingName}>{ingredient.name}</Text>
            <View style={{ marginBottom: 8 }}>
              <View className={styles.ingCategory}>{ingredient.category}</View>
            </View>
            <Text className={styles.ingUnit}>
              单价：{formatPrice(ingredient.pricePerUnit)} / {ingredient.unit}
            </Text>
          </View>
          <View className={classnames(styles.statusBadge, styles[stockStatus])}>
            {statusLabelMap[stockStatus]}
          </View>
        </View>

        {/* 基本信息 */}
        <View className={styles.infoCard}>
          <View className={styles.cardTitle}>📊 库存信息</View>
          <View className={styles.infoGrid}>
            <View className={styles.gridItem}>
              <Text className={styles.label}>当前库存</Text>
              <Text className={classnames(styles.value, styles.stock, styles[stockStatus])}>
                {ingredient.stock}
                <Text className={styles.unit}>{ingredient.unit}</Text>
              </Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.label}>预警阈值</Text>
              <Text className={styles.value}>
                {ingredient.warningThreshold}
                <Text className={styles.unit}>{ingredient.unit}</Text>
              </Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.label}>原料单价</Text>
              <Text className={classnames(styles.value, styles.price)}>
                {formatPrice(ingredient.pricePerUnit)}
                <Text className={styles.unit}>/{ingredient.unit}</Text>
              </Text>
            </View>
            <View className={styles.gridItem}>
              <Text className={styles.label}>库存总价值</Text>
              <Text className={classnames(styles.value, styles.price)}>
                {formatPrice(roundTo(ingredient.stock * ingredient.pricePerUnit, 2))}
              </Text>
            </View>
          </View>
          <View className={styles.stockBar}>
            <View className={styles.barTrack}>
              <View
                className={classnames(styles.barFill, styles[stockStatus])}
                style={{ width: `${stockPercent}%` }}
              />
            </View>
            <View className={styles.barLabel}>
              <Text>0{ingredient.unit}</Text>
              <Text>
                预警 {ingredient.warningThreshold}
                {ingredient.unit}
              </Text>
              <Text>
                建议 {ingredient.warningThreshold * 3}
                {ingredient.unit}
              </Text>
            </View>
          </View>
        </View>

        {/* 关联产品 */}
        {usedInProducts.length > 0 && (
          <View className={styles.infoCard}>
            <View className={styles.cardTitle}>🧋 使用此原料的产品 ({usedInProducts.length})</View>
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {usedInProducts.map((p) => {
                const ri = p.recipe.find((r) => r.ingredientId === ingredient.id);
                return (
                  <View
                    key={p.id}
                    style={{
                      padding: '12rpx 20rpx',
                      background: '#FFF9F5',
                      borderRadius: 12,
                      fontSize: '22rpx',
                      color: '#6B6560',
                    }}
                  >
                    {p.name}
                    {ri && ` (${ri.amount}${ingredient.unit})`}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 补货记录 */}
        <View className={styles.infoCard}>
          <View className={styles.cardTitle}>📝 补货记录</View>
          {records.length === 0 ? (
            <View className={styles.emptyRecord}>暂无补货记录</View>
          ) : (
            <View className={styles.recordList}>
              {records.map((r) => {
                const d = new Date(r.time);
                const timeStr = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                return (
                  <View key={r.id} className={styles.recordItem}>
                    <View className={styles.recordLeft}>
                      <View className={classnames(styles.recordIcon, styles[r.type])}>
                        {r.type === 'in' ? '↓' : '↑'}
                      </View>
                      <View className={styles.recordInfo}>
                        <Text className={styles.recordName}>{r.title}</Text>
                        <Text className={styles.recordTime}>{timeStr}</Text>
                      </View>
                    </View>
                    <View className={styles.recordRight}>
                      <Text className={classnames(styles.recordAmt, styles[r.type])}>
                        {r.type === 'in' ? '+' : '-'}{r.amount}{r.unit}
                      </Text>
                      {r.price !== undefined && (
                        <Text className={styles.recordPrice}>{formatPrice(r.price)}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        <View className={`${styles.btn} ${styles.edit}`} onClick={handleEdit}>
          ✏️ 编辑
        </View>
        <View className={`${styles.btn} ${styles.restock}`} onClick={handleRestock}>
          📦 立即补货
        </View>
      </View>
    </View>
  );
};

export default IngredientDetailPage;
