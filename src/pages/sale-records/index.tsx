import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { formatPrice, categoryLabels, categoryColors, roundTo } from '@/utils';
import type { ProductCategory, SaleRecord } from '@/types';
import styles from './index.module.scss';

const SaleRecordsPage: React.FC = () => {
  const router = useRouter();
  const productIdParam = router.params.productId as string | undefined;
  const productNameParam = router.params.productName as string | undefined;

  const saleRecords = useAppStore((s) => s.saleRecords);
  const products = useAppStore((s) => s.products);

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState<string>(() => {
    if (productIdParam) return todayStr();
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [filterProductId, setFilterProductId] = useState<string | undefined>(productIdParam);
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');

  const startTs = useMemo(() => {
    const [y, m, d] = startDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }, [startDate]);

  const endTs = useMemo(() => {
    const [y, m, d] = endDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() + 86400000;
  }, [endDate]);

  const filteredRecords = useMemo(() => {
    return saleRecords.filter((r) => {
      if (r.createdAt < startTs || r.createdAt >= endTs) return false;
      if (filterProductId && r.productId !== filterProductId) return false;
      if (filterCategory !== 'all') {
        const prod = products.find((p) => p.id === r.productId);
        if (prod && prod.category !== filterCategory) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [saleRecords, startTs, endTs, filterProductId, filterCategory, products]);

  const summary = useMemo(() => {
    let totalCups = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    filteredRecords.forEach((r) => {
      totalCups += r.quantity;
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalProfit += r.totalProfit;
    });
    const avgPerCup = totalCups > 0 ? roundTo(totalRevenue / totalCups, 2) : 0;
    return { totalCups, totalRevenue: roundTo(totalRevenue, 2), totalCost: roundTo(totalCost, 2), totalProfit: roundTo(totalProfit, 2), avgPerCup, orderCount: filteredRecords.length };
  }, [filteredRecords]);

  const productOptions = ['全部产品', ...products.map((p) => p.name)];
  const currentProductIdx = filterProductId
    ? products.findIndex((p) => p.id === filterProductId) + 1
    : 0;

  const categoryOptions = ['全部分类', '奶茶', '果茶', '咖啡'];
  const currentCategoryIdx = filterCategory === 'all' ? 0 : ['milk_tea', 'fruit_tea', 'coffee'].indexOf(filterCategory) + 1;

  const handleProductChange = (e: any) => {
    const idx = Number(e.detail.value);
    if (idx === 0) setFilterProductId(undefined);
    else setFilterProductId(products[idx - 1]?.id);
  };

  const handleCategoryChange = (e: any) => {
    const idx = Number(e.detail.value);
    if (idx === 0) setFilterCategory('all');
    else setFilterCategory((['milk_tea', 'fruit_tea', 'coffee'] as ProductCategory[])[idx - 1]);
  };

  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  };

  const getCategory = (pid: string): ProductCategory | undefined => {
    return products.find((p) => p.id === pid)?.category;
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const quickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setStartDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
    setEndDate(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
  };

  const dateOptions = useMemo(() => {
    const opts: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return opts;
  }, []);

  const startIdx = dateOptions.indexOf(startDate);
  const endIdx = dateOptions.indexOf(endDate);

  return (
    <View>
      <View className={styles.filterBar}>
        <View className={styles.dateRange}>
          <Picker range={dateOptions} value={startIdx >= 0 ? startIdx : 0} onChange={(e) => setStartDate(dateOptions[Number(e.detail.value)])}>
            <View className={styles.dateBtn}>{formatDisplayDate(startDate)}</View>
          </Picker>
          <Text className={styles.dateSep}>至</Text>
          <Picker range={dateOptions} value={endIdx >= 0 ? endIdx : 0} onChange={(e) => setEndDate(dateOptions[Number(e.detail.value)])}>
            <View className={styles.dateBtn}>{formatDisplayDate(endDate)}</View>
          </Picker>
        </View>
        <View className={styles.filterRow}>
          <Picker range={productOptions} value={currentProductIdx} onChange={handleProductChange}>
            <View className={styles.filterBtn}>
              {productNameParam || (filterProductId ? products.find((p) => p.id === filterProductId)?.name : '全部产品')}
              <Text className={styles.arrow}>▼</Text>
            </View>
          </Picker>
          <Picker range={categoryOptions} value={currentCategoryIdx} onChange={handleCategoryChange}>
            <View className={styles.filterBtn}>
              {filterCategory === 'all' ? '全部分类' : categoryLabels[filterCategory]}
              <Text className={styles.arrow}>▼</Text>
            </View>
          </Picker>
        </View>
      </View>

      <View className={styles.quickRange}>
        <View className={classnames(styles.qrBtn, startDate === dateOptions[0] && endDate === dateOptions[0] && styles.qrActive)} onClick={() => quickRange(1)}>今天</View>
        <View className={classnames(styles.qrBtn, styles.qrActive)} onClick={() => quickRange(7)}>近7天</View>
        <View className={styles.qrBtn} onClick={() => quickRange(30)}>近30天</View>
      </View>

      <ScrollView scrollY className={styles.pageContainer} style={{ height: 'calc(100vh - 320rpx)' }}>
        {filteredRecords.length === 0 ? (
          <View className={styles.emptyWrapper}>
            <View className={styles.emptyIcon}>🥤</View>
            <Text className={styles.emptyText}>该时段没有销售记录{'\n'}去点单页卖几杯吧！</Text>
          </View>
        ) : (
          <View>
            <View className={styles.summaryCard}>
              <View className={styles.smRow}>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>总营收</Text>
                  <Text className={classnames(styles.smValue, styles.rev)}>{formatPrice(summary.totalRevenue)}</Text>
                </View>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>总成本</Text>
                  <Text className={classnames(styles.smValue, styles.cost)}>{formatPrice(summary.totalCost)}</Text>
                </View>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>总毛利</Text>
                  <Text className={classnames(styles.smValue, styles.profit)}>{formatPrice(summary.totalProfit)}</Text>
                </View>
              </View>
              <View className={styles.smRow2}>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>总出杯</Text>
                  <Text className={styles.smValue2}>{summary.totalCups} 杯</Text>
                </View>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>客单杯价</Text>
                  <Text className={styles.smValue2}>{formatPrice(summary.avgPerCup)}</Text>
                </View>
                <View className={styles.smItem}>
                  <Text className={styles.smLabel}>毛利率</Text>
                  <Text className={styles.smValue2}>{summary.totalRevenue > 0 ? Math.round((summary.totalProfit / summary.totalRevenue) * 100) : 0}%</Text>
                </View>
              </View>
            </View>

            <View className={styles.sectionTitle}>共 {summary.orderCount} 笔订单，{summary.totalCups} 杯</View>

            {filteredRecords.map((record) => {
              const cat = getCategory(record.productId);
              const catColor = cat ? categoryColors[cat] : null;
              const isToday = new Date(record.createdAt).toDateString() === new Date().toDateString();
              return (
                <View key={record.id} className={styles.recordCard}>
                  <View className={styles.rcTop}>
                    <Text className={styles.rcName}>{record.productName}</Text>
                    <Text className={styles.rcTime}>{isToday ? formatTime(record.createdAt) : `${formatDate(record.createdAt)} ${formatTime(record.createdAt)}`}</Text>
                  </View>
                  {cat && catColor && (
                    <View className={styles.rcTag} style={{ background: catColor.bg, color: catColor.color }}>
                      {categoryLabels[cat]}
                    </View>
                  )}
                  <View className={styles.rcBottom}>
                    <View className={styles.rcStat}>
                      <Text className={styles.rcLabel}>数量</Text>
                      <Text className={`${styles.rcValue} ${styles.qty}`}>{record.quantity}杯</Text>
                    </View>
                    <View className={styles.rcStat}>
                      <Text className={styles.rcLabel}>单价</Text>
                      <Text className={`${styles.rcValue} ${styles.price}`}>{formatPrice(record.sellingPrice)}</Text>
                    </View>
                    <View className={styles.rcStat}>
                      <Text className={styles.rcLabel}>成本</Text>
                      <Text className={`${styles.rcValue} ${styles.cost}`}>{formatPrice(record.unitCost)}</Text>
                    </View>
                    <View className={styles.rcStat}>
                      <Text className={styles.rcLabel}>毛利</Text>
                      <Text className={`${styles.rcValue} ${styles.profit}`}>{formatPrice(record.totalProfit)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SaleRecordsPage;
