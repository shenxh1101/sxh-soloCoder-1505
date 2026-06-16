import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { categoryLabels, categoryColors, formatPrice, calculateSuggestedPrice, roundTo, getStockStatus } from '@/utils';
import type { Ingredient, RecipeItem, ProductCategory } from '@/types';
import styles from './index.module.scss';

interface CalcRecipeItem extends RecipeItem {
  ingredientId: string;
  amount: number;
}

const StatisticsPage: React.FC = () => {
  const ingredients = useAppStore((s) => s.ingredients);
  const saleRecords = useAppStore((s) => s.saleRecords);
  const products = useAppStore((s) => s.products);
  const getProductRank = useAppStore((s) => s.getProductRank);
  const getTodayStats = useAppStore((s) => s.getTodayStats);
  const getCategoryStats = useAppStore((s) => s.getCategoryStats);
  const addProduct = useAppStore((s) => s.addProduct);
  const resetToDefault = useAppStore((s) => s.resetToDefault);

  const todayStats = useMemo(() => getTodayStats(), [getTodayStats, saleRecords]);
  const categoryStats = useMemo(() => getCategoryStats(), [getCategoryStats, saleRecords]);
  const [sortBy, setSortBy] = useState<'quantity' | 'profit'>('quantity');
  const rankList = useMemo(() => getProductRank(sortBy).slice(0, 8), [getProductRank, sortBy, saleRecords]);

  const [dailyDate, setDailyDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const dailySummary = useMemo(() => {
    const [y, m, d] = dailyDate.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d).getTime();
    const dayEnd = dayStart + 86400000;
    const dayRecords = saleRecords.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);

    let totalCups = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const productMap = new Map<string, { name: string; category: ProductCategory; qty: number; revenue: number; profit: number }>();

    dayRecords.forEach((r) => {
      totalCups += r.quantity;
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalProfit += r.totalProfit;
      const existing = productMap.get(r.productId);
      if (existing) {
        existing.qty += r.quantity;
        existing.revenue += r.totalRevenue;
        existing.profit += r.totalProfit;
      } else {
        const prod = products.find((p) => p.id === r.productId);
        productMap.set(r.productId, {
          name: r.productName,
          category: prod?.category || 'milk_tea',
          qty: r.quantity,
          revenue: r.totalRevenue,
          profit: r.totalProfit,
        });
      }
    });

    const productList = Array.from(productMap.entries()).map(([id, data]) => ({ id, ...data }));
    const bestSeller = [...productList].sort((a, b) => b.qty - a.qty)[0];
    const topProfit = [...productList].sort((a, b) => b.profit - a.profit)[0];

    const warningIngs = ingredients.filter((i) => i.stock <= i.warningThreshold);
    const priorityRestock = warningIngs
      .map((ing) => {
        const impacted = products
          .filter((p) => p.recipe.some((r) => r.ingredientId === ing.id))
          .map((p) => {
            const r = p.recipe.find((rr) => rr.ingredientId === ing.id)!;
            return { name: p.name, canMake: Math.floor(ing.stock / r.amount) };
          })
          .sort((a, b) => a.canMake - b.canMake);
        return { ...ing, impacted };
      })
      .sort((a, b) => a.stock - b.stock);

    return {
      totalCups,
      totalRevenue: roundTo(totalRevenue, 2),
      totalCost: roundTo(totalCost, 2),
      totalProfit: roundTo(totalProfit, 2),
      orderCount: dayRecords.length,
      bestSeller,
      topProfit,
      priorityRestock,
    };
  }, [dailyDate, saleRecords, products, ingredients]);

  const dateOptions = useMemo(() => {
    const opts: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return opts;
  }, []);

  const dailyDateIdx = dateOptions.indexOf(dailyDate);

  // 新品计算器状态
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ProductCategory>('milk_tea');
  const [calcRecipe, setCalcRecipe] = useState<CalcRecipeItem[]>([
    { ingredientId: ingredients[0]?.id || '', amount: 100 },
  ]);
  const [targetProfitRate, setTargetProfitRate] = useState(0.66);

  const calcResult = useMemo(() => {
    let totalCost = 0;
    const details = calcRecipe.map((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      const cost = ing ? ing.pricePerUnit * r.amount : 0;
      totalCost += cost;
      return { ...r, cost: roundTo(cost, 4), ingredient: ing };
    });
    totalCost = roundTo(totalCost, 4);
    const suggestedPrice = calculateSuggestedPrice(totalCost, targetProfitRate);
    const unitProfit = roundTo(suggestedPrice - totalCost, 2);
    const profitRate = suggestedPrice > 0 ? roundTo((unitProfit / suggestedPrice) * 100, 0) : 0;

    return { totalCost, suggestedPrice, unitProfit, profitRate, details };
  }, [calcRecipe, ingredients, targetProfitRate]);

  const addRecipeRow = () => {
    const availableId = ingredients.find(
      (i) => !calcRecipe.some((r) => r.ingredientId === i.id)
    )?.id;
    if (availableId) {
      setCalcRecipe([...calcRecipe, { ingredientId: availableId, amount: 50 }]);
    } else {
      Taro.showToast({ title: '所有原料已添加', icon: 'none' });
    }
  };

  const removeRecipeRow = (idx: number) => {
    if (calcRecipe.length <= 1) return;
    setCalcRecipe(calcRecipe.filter((_, i) => i !== idx));
  };

  const updateRecipeAmount = (idx: number, val: string) => {
    const n = parseFloat(val) || 0;
    const arr = [...calcRecipe];
    arr[idx] = { ...arr[idx], amount: n };
    setCalcRecipe(arr);
  };

  const updateRecipeIngredient = (idx: number, ingId: string) => {
    if (!ingId) return;
    const isDuplicate = calcRecipe.some((r, i) => i !== idx && r.ingredientId === ingId);
    if (isDuplicate) {
      const ingName = ingredients.find((i) => i.id === ingId)?.name || '';
      Taro.showToast({ title: `${ingName} 已在配方中`, icon: 'none' });
      return;
    }
    const arr = [...calcRecipe];
    arr[idx] = { ...arr[idx], ingredientId: ingId };
    setCalcRecipe(arr);
  };

  const handleCreateProduct = () => {
    if (!newName.trim()) {
      Taro.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    if (calcResult.totalCost <= 0) {
      Taro.showToast({ title: '请配置有效配方', icon: 'none' });
      return;
    }

    Taro.showModal({
      title: '确认创建产品',
      content: `产品：${newName}\n成本：${formatPrice(calcResult.totalCost)}\n建议售价：${formatPrice(calcResult.suggestedPrice)}\n毛利率：${calcResult.profitRate}%`,
      confirmText: '创建产品',
      cancelText: '取消',
      confirmColor: '#FF8A50',
      success: (res) => {
        if (res.confirm) {
          addProduct({
            name: newName.trim(),
            category: newCategory,
            sellingPrice: calcResult.suggestedPrice,
            recipe: calcRecipe.filter((r) => r.ingredientId && r.amount > 0),
            description: `新品自动创建 · 目标毛利率${Math.round(targetProfitRate * 100)}%`,
          });
          Taro.showToast({ title: '产品创建成功', icon: 'success' });
          setNewName('');
          setCalcRecipe([{ ingredientId: ingredients[0]?.id || '', amount: 100 }]);
        }
      },
    });
  };

  const ingredientPickerOptions = ingredients.map((i) => i.name);

  const catStatMap = useMemo(() => {
    const m: Record<string, { qty: number; rev: number }> = {};
    categoryStats.forEach((c) => {
      m[c.category] = { qty: c.quantity, rev: c.totalRevenue };
    });
    return m;
  }, [categoryStats]);

  const totalAll = useMemo(() => {
    let rev = 0, cost = 0, profit = 0, cups = 0;
    saleRecords.forEach((r) => {
      rev += r.totalRevenue;
      cost += r.totalCost;
      profit += r.totalProfit;
      cups += r.quantity;
    });
    return {
      revenue: roundTo(rev, 2),
      cost: roundTo(cost, 2),
      profit: roundTo(profit, 2),
      cups,
    };
  }, [saleRecords]);

  return (
    <ScrollView scrollY className={`${styles.pageContainer} pageContainer`}>
      {/* 整体概览 */}
      <View className={styles.sectionBlock}>
        <Text className={styles.sectionTitle}>📊 经营概览</Text>
        <View className={styles.overviewCards}>
          <View className={styles.card}>
            <Text className={styles.cardLabel}>累计营收</Text>
            <View>
              <Text className={styles.cardValue}>¥{totalAll.revenue}</Text>
            </View>
            <Text className={styles.cardExtra}>累计出杯 {totalAll.cups} 杯</Text>
          </View>
          <View className={styles.card}>
            <Text className={styles.cardLabel}>累计毛利</Text>
            <View>
              <Text className={styles.cardValue}>¥{totalAll.profit}</Text>
            </View>
            <Text className={styles.cardExtra}>
              毛利率 {totalAll.revenue > 0 ? Math.round((totalAll.profit / totalAll.revenue) * 100) : 0}%
            </Text>
          </View>
        </View>
        <View className={styles.quickStats}>
          <View className={styles.quickItem}>
            <Text className={styles.qLabel}>今日出杯</Text>
            <Text className={styles.qValue}>{todayStats.totalCups}杯</Text>
          </View>
          <View className={styles.quickItem}>
            <Text className={styles.qLabel}>今日营收</Text>
            <Text className={styles.qValue}>¥{todayStats.totalRevenue}</Text>
          </View>
          <View className={styles.quickItem}>
            <Text className={styles.qLabel}>今日毛利</Text>
            <Text className={styles.qValue}>¥{todayStats.totalProfit}</Text>
          </View>
        </View>
      </View>

      {/* 每日收银小结 */}
      <View className={styles.sectionBlock}>
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24rpx' }}>
          <Text className={styles.sectionTitle} style={{ marginBottom: 0 }}>🏷️ 每日收银小结</Text>
          <Picker
            range={dateOptions}
            value={dailyDateIdx >= 0 ? dailyDateIdx : 0}
            onChange={(e) => setDailyDate(dateOptions[Number(e.detail.value)])}
          >
            <View style={{
              padding: '6rpx 20rpx',
              background: 'rgba(255,138,80,0.1)',
              borderRadius: 32,
              fontSize: 24,
              color: '#FF8A50',
              fontWeight: '500',
            }}>
              {dailyDate.split('-').slice(1).join('/')} ▾
            </View>
          </Picker>
        </View>

        {dailySummary.orderCount === 0 ? (
          <View style={{ padding: '48rpx 0', textAlign: 'center', color: '#A09A94', fontSize: '24rpx' }}>
            当天没有销售记录
          </View>
        ) : (
          <View>
            <View style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16rpx',
              marginBottom: '24rpx',
            }}>
              <View style={{ textAlign: 'center', padding: '16rpx', background: '#FFF9F5', borderRadius: 12 }}>
                <Text style={{ display: 'block', fontSize: 22, color: '#A09A94', marginBottom: 4 }}>出杯</Text>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FF8A50' }}>{dailySummary.totalCups}</Text>
              </View>
              <View style={{ textAlign: 'center', padding: '16rpx', background: '#FFF9F5', borderRadius: 12 }}>
                <Text style={{ display: 'block', fontSize: 22, color: '#A09A94', marginBottom: 4 }}>营收</Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333' }}>¥{dailySummary.totalRevenue}</Text>
              </View>
              <View style={{ textAlign: 'center', padding: '16rpx', background: '#FFF9F5', borderRadius: 12 }}>
                <Text style={{ display: 'block', fontSize: 22, color: '#A09A94', marginBottom: 4 }}>成本</Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#FF6B6B' }}>¥{dailySummary.totalCost}</Text>
              </View>
              <View style={{ textAlign: 'center', padding: '16rpx', background: '#FFF9F5', borderRadius: 12 }}>
                <Text style={{ display: 'block', fontSize: 22, color: '#A09A94', marginBottom: 4 }}>毛利</Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4CAF50' }}>¥{dailySummary.totalProfit}</Text>
              </View>
            </View>

            {dailySummary.bestSeller && (
              <View style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20rpx 24rpx',
                background: '#FFF9F5',
                borderRadius: 12,
                marginBottom: 16,
              }}>
                <View>
                  <Text style={{ fontSize: 22, color: '#A09A94' }}>🏆 今日热销</Text>
                  <Text style={{ fontSize: 28, fontWeight: '600', color: '#333', marginLeft: 8 }}>{dailySummary.bestSeller.name}</Text>
                </View>
                <Text style={{ fontSize: 24, color: '#FF8A50', fontWeight: '500' }}>{dailySummary.bestSeller.qty}杯</Text>
              </View>
            )}

            {dailySummary.topProfit && (
              <View style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20rpx 24rpx',
                background: '#FFF9F5',
                borderRadius: 12,
                marginBottom: 16,
              }}>
                <View>
                  <Text style={{ fontSize: 22, color: '#A09A94' }}>💰 利润最高</Text>
                  <Text style={{ fontSize: 28, fontWeight: '600', color: '#333', marginLeft: 8 }}>{dailySummary.topProfit.name}</Text>
                </View>
                <Text style={{ fontSize: 24, color: '#4CAF50', fontWeight: '500' }}>¥{roundTo(dailySummary.topProfit.profit, 2)}</Text>
              </View>
            )}

            {dailySummary.priorityRestock.length > 0 && (
              <View style={{ marginTop: '16rpx' }}>
                <Text style={{ fontSize: 22, color: '#F53F3F', fontWeight: '500', marginBottom: 12, display: 'block' }}>
                  ⚠️ 优先补货 ({dailySummary.priorityRestock.length}种)
                </Text>
                {dailySummary.priorityRestock.slice(0, 3).map((ing) => (
                  <View
                    key={ing.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16rpx 24rpx',
                      background: 'rgba(245,63,63,0.04)',
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 26, fontWeight: '500', color: '#333' }}>{ing.name}</Text>
                      <Text style={{ fontSize: 22, color: '#F53F3F', marginLeft: 8 }}>
                        剩{ing.stock}{ing.unit}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 22, color: '#A09A94' }}>
                      {ing.impacted.length > 0 ? `影响${ing.impacted.length}款` : '暂无关联饮品'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 分类占比 */}
      <View className={styles.sectionBlock}>
        <Text className={styles.sectionTitle}>🧋 分类销售</Text>
        <View className={styles.quickStats}>
          {(['milk_tea', 'fruit_tea', 'coffee'] as ProductCategory[]).map((cat) => {
            const data = catStatMap[cat] || { qty: 0, rev: 0 };
            const cc = categoryColors[cat];
            return (
              <View key={cat} className={styles.quickItem} style={{ padding: '8rpx 0' }}>
                <View
                  style={{
                    display: 'inline-flex',
                    padding: '4rpx 16rpx',
                    borderRadius: '8rpx',
                    background: cc.bg,
                    color: cc.color,
                    fontSize: '22rpx',
                    marginBottom: 8,
                  }}
                >
                  {categoryLabels[cat]}
                </View>
                <Text className={styles.qValue} style={{ fontSize: '28rpx' }}>
                  {data.qty}杯
                </Text>
                <Text className={styles.qLabel}>¥{data.rev}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 产品排行 */}
      <View className={styles.sectionBlock}>
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24rpx' }}>
          <Text className={styles.sectionTitle} style={{ marginBottom: 0 }}>🏆 热销排行</Text>
          <View className={styles.sortTabs} style={{ marginBottom: 0 }}>
            <View
              className={classnames(styles.tabItem, sortBy === 'quantity' && styles.active)}
              onClick={() => setSortBy('quantity')}
            >
              按销量
            </View>
            <View
              className={classnames(styles.tabItem, sortBy === 'profit' && styles.active)}
              onClick={() => setSortBy('profit')}
            >
              按利润
            </View>
          </View>
        </View>

        {rankList.length === 0 ? (
          <View className={styles.emptyRank}>暂无销售数据，去首页卖几杯吧～</View>
        ) : (
          <View className={styles.rankList}>
            {rankList.map((item, idx) => {
              const cc = categoryColors[item.category];
              return (
                <View
                  key={item.productId}
                  className={styles.rankCard}
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/sale-records/index?productId=${item.productId}&productName=${encodeURIComponent(item.productName)}`,
                    });
                  }}
                >
                  <View className={styles.rankHeader}>
                    <View className={styles.rankLeft}>
                      <View
                        className={classnames(
                          styles.rankNo,
                          idx === 0 && styles.top1,
                          idx === 1 && styles.top2,
                          idx === 2 && styles.top3
                        )}
                      >
                        {idx + 1}
                      </View>
                      <Text className={styles.rankName}>{item.productName}</Text>
                    </View>
                    <View className={styles.rankTag} style={{ background: cc.bg, color: cc.color }}>
                      {categoryLabels[item.category]}
                    </View>
                  </View>
                  <View className={styles.rankBody}>
                    <View className={styles.rankStat}>
                      <Text className={styles.statLabel}>销量</Text>
                      <Text className={`${styles.statValue} ${styles.qty}`}>
                        {item.quantity}杯
                      </Text>
                    </View>
                    <View className={styles.rankStat}>
                      <Text className={styles.statLabel}>营收</Text>
                      <Text className={`${styles.statValue} ${styles.rev}`}>
                        ¥{item.totalRevenue}
                      </Text>
                    </View>
                    <View className={styles.rankStat}>
                      <Text className={styles.statLabel}>总利润</Text>
                      <Text className={`${styles.statValue} ${styles.profit}`}>
                        ¥{item.totalProfit}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 新品成本计算器 */}
      <View className={styles.sectionBlock}>
        <Text className={styles.sectionTitle}>✨ 新品成本计算器</Text>
        <View className={styles.calculatorCard}>
          <View className={styles.calcHeader}>
            <Text className={styles.calcTitle}>填配方，自动算成本和售价</Text>
            <View className={styles.calcBadge}>新品利器</View>
          </View>

          <View className={styles.formGroup}>
            <Text className={styles.groupLabel}>产品名称</Text>
            <View className={styles.inputWrapper}>
              <Input
                className={styles.input}
                placeholder="例如：杨枝甘露"
                value={newName}
                onInput={(e) => setNewName(e.detail.value)}
              />
            </View>
          </View>

          <View className={styles.formGroup}>
            <Text className={styles.groupLabel}>产品分类</Text>
            <Picker
              range={['奶茶', '果茶', '咖啡']}
              rangeKey="label"
              value={['milk_tea', 'fruit_tea', 'coffee'].indexOf(newCategory)}
              onChange={(e) => {
                const cats: ProductCategory[] = ['milk_tea', 'fruit_tea', 'coffee'];
                setNewCategory(cats[Number(e.detail.value)]);
              }}
            >
              <View className={styles.rowSelect}>
                <Text>{categoryLabels[newCategory]}</Text>
                <Text>▼</Text>
              </View>
            </Picker>
          </View>

          <View className={styles.formGroup}>
            <Text className={styles.groupLabel}>目标毛利率</Text>
            <View className={styles.rowSelect} style={{ width: '100%' }}>
              <Picker
                range={['50% (薄利多销)', '60% (标准)', '66% (推荐)', '70% (高端产品)']}
                value={[0.5, 0.6, 0.66, 0.7].indexOf(targetProfitRate)}
                onChange={(e) => {
                  const vals = [0.5, 0.6, 0.66, 0.7];
                  setTargetProfitRate(vals[Number(e.detail.value)]);
                }}
              >
                <View style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                  <Text>{Math.round(targetProfitRate * 100)}%</Text>
                  <Text>▼</Text>
                </View>
              </Picker>
            </View>
          </View>

          <View className={styles.formGroup}>
            <Text className={styles.groupLabel}>配方配置</Text>
            <View className={styles.recipeList}>
              {calcRecipe.map((r, idx) => {
                const ing = ingredients.find((i) => i.id === r.ingredientId);
                const cost = ing ? ing.pricePerUnit * r.amount : 0;
                return (
                  <View key={idx} className={styles.recipeItem}>
                    <Picker
                      range={ingredientPickerOptions}
                      value={ingredients.findIndex((i) => i.id === r.ingredientId)}
                      onChange={(e) => {
                        const ingIdx = Number(e.detail.value);
                        updateRecipeIngredient(idx, ingredients[ingIdx]?.id || '');
                      }}
                    >
                      <Text className={styles.riName}>
                        {ing?.name || '请选择原料'}
                      </Text>
                    </Picker>
                    <Input
                      className={styles.riInput}
                      type="digit"
                      value={r.amount.toString()}
                      onInput={(e) => updateRecipeAmount(idx, e.detail.value)}
                    />
                    <Text className={styles.riUnit}>{ing?.unit || 'g'}</Text>
                    <Text className={styles.riCost}>¥{roundTo(cost, 2)}</Text>
                    <View className={styles.riRemove} onClick={() => removeRecipeRow(idx)}>
                      ×
                    </View>
                  </View>
                );
              })}
            </View>
            <View className={styles.addRecipeBtn} onClick={addRecipeRow}>
              + 添加原料
            </View>
          </View>

          {/* 计算结果 */}
          <View className={styles.resultBox}>
            <View className={styles.resRow}>
              <Text className={styles.resLabel}>物料总成本</Text>
              <Text className={`${styles.bigValue} ${styles.cost}`}>
                {formatPrice(calcResult.totalCost)}
              </Text>
            </View>
            <View className={styles.resRow}>
              <Text className={styles.resLabel}>建议售价 ({Math.round(targetProfitRate * 100)}%毛利)</Text>
              <Text className={`${styles.bigValue} ${styles.price}`}>
                {formatPrice(calcResult.suggestedPrice)}
              </Text>
            </View>
            <View className={styles.resRow}>
              <Text className={styles.resLabel}>单杯毛利</Text>
              <Text className={`${styles.resValue} ${styles.profit}`}>
                {formatPrice(calcResult.unitProfit)}
              </Text>
            </View>
            <View className={styles.resRow}>
              <Text className={styles.resLabel}>实际毛利率</Text>
              <Text className={`${styles.resValue} ${styles.rate}`}>
                {calcResult.profitRate}%
              </Text>
            </View>

            <View
              className={classnames('btnPrimary')}
              style={{ width: '100%', marginTop: '32rpx', justifyContent: 'center' }}
              onClick={handleCreateProduct}
            >
              💾 按此配方创建产品
            </View>

            <View className={styles.tip}>
              💡 小提示：建议零售价通常是成本的3~4倍（毛利率66~75%），竞争激烈区域可适当下调至2.5倍（毛利率60%）。
            </View>
          </View>
        </View>
      </View>

      {/* 底部操作 */}
      <View style={{ padding: '0 32rpx 40rpx' }}>
        <View
          style={{
            height: 88,
            borderRadius: 48,
            background: 'linear-gradient(135deg, #FF8A50 0%, #FFB088 100%)',
            color: '#fff',
            fontSize: 28,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4rpx 16rpx rgba(255, 138, 80, 0.3)',
            marginBottom: 24,
          }}
          onClick={() => Taro.navigateTo({ url: '/pages/sale-records/index' })}
        >
          📋 查看全部销售记录
        </View>
        <View
          style={{
            height: 72,
            borderRadius: 48,
            background: '#F7F2ED',
            color: '#A09A94',
            fontSize: 24,
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => {
            Taro.showModal({
              title: '恢复默认数据',
              content: '确定要恢复为初始演示数据吗？所有操作记录将被清空。',
              confirmText: '恢复默认',
              cancelText: '取消',
              confirmColor: '#F53F3F',
              success: (res) => {
                if (res.confirm) {
                  resetToDefault();
                  Taro.showToast({ title: '已恢复默认数据', icon: 'success' });
                }
              },
            });
          }}
        >
          🔄 恢复默认演示数据
        </View>
      </View>
    </ScrollView>
  );
};

export default StatisticsPage;
