import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { getStockStatus, formatPrice } from '@/utils';
import type { Ingredient } from '@/types';
import styles from './index.module.scss';

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
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const ingredients = useAppStore((state) => state.ingredients);
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
        <View className={styles.addBtn} onClick={handleAdd}>
          + 新增原料
        </View>
      </View>

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
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default InventoryPage;
