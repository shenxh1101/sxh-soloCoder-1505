import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { getStockStatus, formatPrice } from '@/utils';
import type { Ingredient } from '@/types';
import styles from './index.module.scss';

type PageTab = 'inventory' | 'restock';
type FilterType = 'all' | 'warning' | 'critical' | 'safe';

const categoryIconMap: Record<string, string> = {
  乳制品: '🥛',
  茶底: '🍵',
  糖浆: '🍯',
  配料: '🧋',
  水果: '🍓',
  咖啡: '☕',
  其他: '📦',
};

const statusLabelMap: Record<string, string> = {
  safe: '库存充足',
  warning: '库存偏低',
  critical: '紧急补货',
};

const filterOptions: Array<{ key: FilterType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'critical', label: '缺货' },
  { key: 'warning', label: '预警' },
  { key: 'safe', label: '正常' },
];

const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PageTab>('inventory');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const ingredients = useAppStore((state) => state.ingredients);
  const products = useAppStore((state) => state.products);
  const saleRecords = useAppStore((state) => state.saleRecords);
  const restockIngredient = useAppStore((state) => state.restockIngredient);

  const summary = useMemo(() => {
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    ingredients.forEach((ing) => {
      const status = getStockStatus(ing.stock, ing.warningThreshold);
      if (status === 'safe') safeCount++;
      else if (status === 'warning') warningCount++;
      else criticalCount++;
    });
    return {
      total: ingredients.length,
      safe: safeCount,
      warning: warningCount,
      critical: criticalCount,
    };
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    if (activeFilter === 'all') return ingredients;
    return ingredients.filter((ing) => {
      const status = getStockStatus(ing.stock, ing.warningThreshold);
      return status === activeFilter;
    });
  }, [ingredients, activeFilter]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Ingredient[]>();
    filteredIngredients.forEach((ing) => {
      const list = groups.get(ing.category) || [];
      list.push(ing);
      groups.set(ing.category, list);
    });
    return Array.from(groups.entries());
  }, [filteredIngredients]);

  const restockList = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recentSales = saleRecords.filter((r) => r.createdAt >= sevenDaysAgo);

    const productDailyUsage = new Map<string, number>();
    recentSales.forEach((r) => {
      const existing = productDailyUsage.get(r.productId) || 0;
      productDailyUsage.set(r.productId, existing + r.quantity / 7);
    });

    return ingredients.map((ing) => {
      let dailyConsumption = 0;
      products.forEach((p) => {
        const recipeItem = p.recipe.find((r) => r.ingredientId === ing.id);
        if (recipeItem) {
          const avgDaily = productDailyUsage.get(p.id) || 0;
          dailyConsumption += avgDaily * recipeItem.amount;
        }
      });

      const daysRemaining = dailyConsumption > 0 ? ing.stock / dailyConsumption : 999;
      const sevenDayNeed = dailyConsumption * 7;
      const suggestAmount = Math.max(0, Math.ceil((sevenDayNeed - ing.stock) / (ing.unit === 'ml' ? 500 : ing.unit === 'g' ? 250 : 10))) * (ing.unit === 'ml' ? 500 : ing.unit === 'g' ? 250 : 10);
      const priority = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'high' : daysRemaining <= 7 ? 'medium' : 'low';

      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        category: ing.category,
        currentStock: ing.stock,
        warningThreshold: ing.warningThreshold,
        dailyConsumption: Number(dailyConsumption.toFixed(1)),
        daysRemaining: Number(daysRemaining.toFixed(1)),
        suggestAmount: suggestAmount,
        priority,
      };
    }).filter((item) => item.priority !== 'low' || item.currentStock <= item.warningThreshold).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [ingredients, products, saleRecords]);

  const restockSummary = useMemo(() => {
    let totalItems = 0;
    let totalAmount = 0;
    let criticalCount = 0;
    restockList.forEach((item) => {
      if (item.suggestAmount > 0) {
        totalItems++;
        totalAmount += item.suggestAmount;
        if (item.priority === 'critical') criticalCount++;
      }
    });
    return { totalItems, totalAmount: Number(totalAmount.toFixed(0)), criticalCount };
  }, [restockList]);

  const handleCopyRestockList = () => {
    if (restockSummary.totalItems === 0) {
      Taro.showToast({ title: '暂无需要补货的原料', icon: 'none' });
      return;
    }
    let text = `📦 补货清单 - ${new Date().toLocaleDateString('zh-CN')}\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `共 ${restockSummary.totalItems} 种需补货\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;
    const priorityLabel = { critical: '🔴 紧急', high: '🟡 高优', medium: '🟢 中优', low: '⚪ 低优' };

    Object.entries(restockList.reduce((acc, item) => {
      if (item.suggestAmount <= 0) return acc;
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof restockList>)).forEach(([category, list]) => {
      text += `【${category}】\n`;
      list.forEach((item) => {
        if (item.suggestAmount <= 0) return;
        text += `${priorityLabel[item.priority]} ${item.name}: 建议补 ${item.suggestAmount}${item.unit}（当前${item.currentStock}${item.unit}，日均消耗${item.dailyConsumption}${item.unit}，还剩${item.daysRemaining}天）\n`;
      });
      text += `\n`;
    });
    Taro.setClipboardData({ data: text, success: () => Taro.showToast({ title: '补货清单已复制', icon: 'success' }) });
  };

  const handleRestock = (ingredient: Ingredient) => {
    const suggestAmount = ingredient.unit === 'ml' ? 1000 : 500;
    Taro.showModal({
      title: `补货 - ${ingredient.name}`,
      editable: true,
      placeholderText: `请输入补货数量(${ingredient.unit})，建议 ${suggestAmount}`,
      confirmText: '确认补货',
      cancelText: '取消',
      confirmColor: '#FF8A50',
      success: (res) => {
        if (res.confirm && res.content) {
          const amount = parseFloat(res.content);
          if (isNaN(amount) || amount <= 0) {
            Taro.showToast({ title: '请输入有效数量', icon: 'none' });
            return;
          }
          const totalPrice = Number((amount * ingredient.pricePerUnit).toFixed(2));
          Taro.showModal({
            title: '确认补货',
            content: `补货数量：${amount}${ingredient.unit}\n预计花费：${formatPrice(totalPrice)}`,
            confirmText: '确认',
            cancelText: '取消',
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

  const handleAdd = () => {
    Taro.navigateTo({ url: '/pages/ingredient-edit/index' });
  };

  const handleEdit = (ingredient: Ingredient) => {
    Taro.navigateTo({ url: `/pages/ingredient-edit/index?id=${ingredient.id}` });
  };

  return (
    <ScrollView scrollY className={styles.pageContainer} style={{ height: '100vh' }}>
      {/* 头部 */}
      <View className={styles.header}>
        <Text className={styles.title}>库存管理</Text>
        <View style={{ display: 'flex', gap: '16rpx' }}>
          {activeTab === 'restock' && (
            <View className={styles.copyBtn} onClick={handleCopyRestockList}>
              📋 复制清单
            </View>
          )}
          <View className={styles.logBtn} onClick={() => Taro.navigateTo({ url: '/pages/stock-logs/index' })}>
            📋 流水
          </View>
          <View className={styles.addBtn} onClick={handleAdd}>
            + 新增
          </View>
        </View>
      </View>

      {/* Tab 切换 */}
      <View className={styles.tabBar}>
        <View
          className={classnames(styles.tabItem, activeTab === 'inventory' && styles.tabActive)}
          onClick={() => setActiveTab('inventory')}
        >
          📦 库存
        </View>
        <View
          className={classnames(styles.tabItem, activeTab === 'restock' && styles.tabActive)}
          onClick={() => setActiveTab('restock')}
        >
          🛒 补货清单
        </View>
      </View>

      {activeTab === 'inventory' ? (
        <View>
          {/* 汇总卡片 */}
          <View className={styles.summaryCards}>
        <View className={styles.sumCard}>
          <Text className={styles.sumLabel}>原料总数</Text>
          <View>
            <Text className={classnames(styles.sumValue, styles.total)}>{summary.total}</Text>
            <Text className={styles.sumUnit}>种</Text>
          </View>
        </View>
        <View className={styles.sumCard}>
          <Text className={styles.sumLabel}>预警原料</Text>
          <View>
            <Text className={classnames(styles.sumValue, summary.warning > 0 ? styles.warning : styles.safe)}>
              {summary.warning}
            </Text>
            <Text className={styles.sumUnit}>种</Text>
          </View>
        </View>
        <View className={styles.sumCard}>
          <Text className={styles.sumLabel}>紧急缺货</Text>
          <View>
            <Text className={classnames(styles.sumValue, summary.critical > 0 ? styles.warning : styles.safe)}>
              {summary.critical}
            </Text>
            <Text className={styles.sumUnit}>种</Text>
          </View>
        </View>
      </View>

      {/* 筛选栏 */}
      <View className={styles.filterBar}>
        {filterOptions.map((opt) => (
          <View
            key={opt.key}
            className={classnames(styles.filterItem, activeFilter === opt.key && styles.active)}
            onClick={() => setActiveFilter(opt.key)}
          >
            {opt.label}
            {opt.key !== 'all' && (
              <Text style={{ marginLeft: 4 }}>
                ({opt.key === 'safe' ? summary.safe : opt.key === 'warning' ? summary.warning : summary.critical})
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* 原料列表 */}
      {filteredIngredients.length === 0 ? (
        <View className={styles.emptyWrapper}>
          <View className={styles.emptyIcon}>📦</View>
          <Text className={styles.emptyText}>暂无符合条件的原料</Text>
        </View>
      ) : (
        <View>
          {groupedByCategory.map(([category, list]) => (
            <View key={category} className={styles.categoryGroup}>
              <View className={styles.categoryTitle}>
                <Text className={styles.titleText}>
                  {categoryIconMap[category] || '📦'} {category}
                </Text>
                <View className={styles.countBadge}>{list.length} 种</View>
              </View>
              {list.map((ingredient) => {
                const status = getStockStatus(ingredient.stock, ingredient.warningThreshold);
                let impactedDrinks: Array<{ productId: string; productName: string; canMake: number }> = [];
                if (status !== 'safe') {
                  impactedDrinks = products
                    .filter((p) => p.recipe.some((r) => r.ingredientId === ingredient.id))
                    .map((p) => {
                      const r = p.recipe.find((rr) => rr.ingredientId === ingredient.id)!;
                      const canMake = Math.floor(ingredient.stock / r.amount);
                      return { productId: p.id, productName: p.name, canMake };
                    })
                    .sort((a, b) => a.canMake - b.canMake);
                }

                return (
                  <View
                    key={ingredient.id}
                    className={styles.ingredientCard}
                  >
                    <View className={styles.cardMain}>
                      <View className={styles.leftInfo}>
                        <View className={styles.ingIcon}>
                          {categoryIconMap[ingredient.category] || '📦'}
                        </View>
                        <View className={styles.ingText}>
                          <Text className={styles.ingName}>{ingredient.name}</Text>
                          <Text className={styles.ingPrice}>
                            {formatPrice(ingredient.pricePerUnit)} / {ingredient.unit}
                            {` · 预警阈值 ${ingredient.warningThreshold}${ingredient.unit}`}
                          </Text>
                        </View>
                      </View>
                      <View
                        className={classnames(styles.statusBadge, styles[status])}
                      >
                        {statusLabelMap[status]}
                      </View>
                    </View>
                    <View className={styles.stockRow}>
                      <View className={styles.stockInfo}>
                        <Text className={classnames(styles.stockNum, styles[status])}>
                          {ingredient.stock}
                        </Text>
                        <Text className={styles.stockUnit}>{ingredient.unit}</Text>
                      </View>
                      <View className={styles.actionBtns}>
                        <View className={styles.editBtn} onClick={() => handleEdit(ingredient)}>
                          编辑
                        </View>
                        <View className={styles.restockBtn} onClick={() => handleRestock(ingredient)}>
                          + 补货
                        </View>
                      </View>
                    </View>
                    {impactedDrinks.length > 0 && (
                      <View className={styles.impactRow}>
                        <Text className={styles.impactLabel}>
                          🥤 影响 {impactedDrinks.length} 款饮品，最少可做 {impactedDrinks[0]?.canMake || 0} 杯
                        </Text>
                        <View className={styles.impactList}>
                          {impactedDrinks.slice(0, 4).map((d) => (
                            <View key={d.productId} className={styles.impactItem}>
                              <Text className={styles.impactName}>{d.productName}</Text>
                              <Text className={styles.impactCups}>
                                剩 <Text className={styles.impactCupsNum}>{d.canMake}</Text> 杯
                              </Text>
                            </View>
                          ))}
                          {impactedDrinks.length > 4 && (
                            <Text className={styles.impactMore}>+{impactedDrinks.length - 4} 款</Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        )}
      </View>
      ) : (
        <View style={{ padding: '0 32rpx 40rpx' }}>
          {restockList.filter((i) => i.suggestAmount > 0).length === 0 ? (
            <View className={styles.emptyWrapper}>
              <View className={styles.emptyIcon}>✅</View>
              <Text className={styles.emptyText}>库存充足，暂无需补货</Text>
            </View>
          ) : (
            <View>
              <View className={styles.restockSummary}>
                <View className={styles.restockSumItem}>
                  <Text className={styles.rsLabel}>需补货</Text>
                  <Text className={styles.rsValue} style={{ color: '#F53F3F' }}>{restockSummary.totalItems} 种</Text>
                </View>
                <View className={styles.restockSumItem}>
                  <Text className={styles.rsLabel}>紧急补货</Text>
                  <Text className={styles.rsValue} style={{ color: '#F53F3F' }}>{restockSummary.criticalCount} 种</Text>
                </View>
                <View className={styles.restockSumItem}>
                  <Text className={styles.rsLabel}>建议总量</Text>
                  <Text className={styles.rsValue}>{restockSummary.totalAmount}</Text>
                </View>
              </View>

              {restockList.filter((i) => i.suggestAmount > 0).map((item) => {
                const priColor = item.priority === 'critical' ? '#F53F3F' : item.priority === 'high' ? '#FF9800' : '#4CAF50';
                const priBg = item.priority === 'critical' ? 'rgba(245,63,63,0.08)' : item.priority === 'high' ? 'rgba(255,152,0,0.08)' : 'rgba(76,175,80,0.08)';
                const priLabel = item.priority === 'critical' ? '紧急' : item.priority === 'high' ? '高优' : '中优';
                return (
                  <View key={item.id} className={styles.restockCard}>
                    <View className={styles.rcTop}>
                      <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                        <View className={styles.rcIcon}>{categoryIconMap[item.category] || '📦'}</View>
                        <View>
                          <Text className={styles.rcName}>{item.name}</Text>
                          <Text className={styles.rcSub}>
                            {item.category} · 日均消耗{item.dailyConsumption}{item.unit}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          padding: '4rpx 16rpx',
                          borderRadius: 8,
                          background: priBg,
                          color: priColor,
                          fontSize: 22,
                          fontWeight: '500',
                        }}
                      >
                        {priLabel} · 剩{item.daysRemaining}天
                      </View>
                    </View>
                    <View className={styles.rcBottom}>
                      <View style={{ flex: 1 }}>
                        <Text className={styles.rcLabel}>当前库存</Text>
                        <Text className={styles.rcValue}>{item.currentStock}{item.unit}</Text>
                      </View>
                      <View style={{ flex: 1, textAlign: 'center' }}>
                        <Text className={styles.rcLabel}>预警阈值</Text>
                        <Text className={styles.rcValue}>{item.warningThreshold}{item.unit}</Text>
                      </View>
                      <View style={{ flex: 1, textAlign: 'right' }}>
                        <Text className={styles.rcLabel} style={{ color: '#FF8A50' }}>建议补货</Text>
                        <Text className={styles.rcValue} style={{ color: '#FF8A50', fontWeight: 'bold' }}>{item.suggestAmount}{item.unit}</Text>
                      </View>
                    </View>
                    <View className={styles.rcBtnRow}>
                      <View
                        className={styles.rcBtn}
                        onClick={() => {
                          const ing = ingredients.find((i) => i.id === item.id);
                          if (ing) handleRestock(ing);
                        }}
                      >
                        + 一键补货
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default InventoryPage;
