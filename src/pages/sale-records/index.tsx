import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { formatPrice, categoryLabels, categoryColors, roundTo } from '@/utils';
import type { ProductCategory } from '@/types';
import styles from './index.module.scss';

const SaleRecordsPage: React.FC = () => {
  const router = useRouter();
  const productIdParam = router.params.productId as string | undefined;
  const productNameParam = router.params.productName ? decodeURIComponent(router.params.productName as string) : undefined;

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

  const toTs = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  const startTs = useMemo(() => toTs(startDate), [startDate]);
  const endTs = useMemo(() => toTs(endDate) + 86400000, [endDate]);

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
    let totalCups = 0, totalRevenue = 0, totalCost = 0, totalProfit = 0, orderCount = 0;
    filteredRecords.forEach((r) => {
      if (r.type === 'init') return;
      totalCups += r.quantity;
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalProfit += r.totalProfit;
      orderCount++;
    });
    const avgPerCup = totalCups > 0 ? roundTo(totalRevenue / totalCups, 2) : 0;
    return { totalCups, totalRevenue: roundTo(totalRevenue, 2), totalCost: roundTo(totalCost, 2), totalProfit: roundTo(totalProfit, 2), avgPerCup, orderCount };
  }, [filteredRecords]);

  const bestSeller = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    filteredRecords.forEach((r) => {
      if (r.type === 'init') return;
      const e = map.get(r.productId);
      if (e) e.qty += r.quantity;
      else map.set(r.productId, { name: r.productName, qty: r.quantity });
    });
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.qty - a.qty);
    return arr[0];
  }, [filteredRecords]);

  const comparison = useMemo(() => {
    const rangeDays = Math.round((endTs - startTs) / 86400000);
    const prevStart = startTs - (rangeDays * 86400000);
    const prevEnd = startTs;

    const prevRecords = saleRecords.filter((r) => r.createdAt >= prevStart && r.createdAt < prevEnd);
    let prevCups = 0, prevRevenue = 0, prevProfit = 0;
    let prevBestName = '';
    {
      const map = new Map<string, { name: string; qty: number }>();
      prevRecords.forEach((r) => {
        if (r.type !== 'init') {
          prevCups += r.quantity;
          prevRevenue += r.totalRevenue;
          prevProfit += r.totalProfit;
          const e = map.get(r.productId);
          if (e) e.qty += r.quantity;
          else map.set(r.productId, { name: r.productName, qty: r.quantity });
        }
      });
      const arr = Array.from(map.values());
      arr.sort((a, b) => b.qty - a.qty);
      prevBestName = arr[0]?.name || '-';
    }

    const prevRangeLabel = (() => {
      const s = new Date(prevStart);
      const e = new Date(prevEnd - 1);
      if (rangeDays === 1) return `昨天`;
      return `${s.getMonth() + 1}/${s.getDate()}-${e.getMonth() + 1}/${e.getDate()}`;
    })();
    const curRangeLabel = (() => {
      if (rangeDays === 1) return '今天';
      const s = new Date(startTs);
      const e = new Date(endTs - 1);
      return `${s.getMonth() + 1}/${s.getDate()}-${e.getMonth() + 1}/${e.getDate()}`;
    })();

    const diff = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : roundTo(((cur - prev) / prev) * 100, 0);
    const diffTag = (val: number) => val > 0 ? `↑${val}%` : val < 0 ? `↓${Math.abs(val)}%` : '持平';

    return {
      curRangeLabel, prevRangeLabel,
      cups: { cur: summary.totalCups, prev: prevCups, diff: diff(summary.totalCups, prevCups), tag: diffTag(diff(summary.totalCups, prevCups)) },
      revenue: { cur: summary.totalRevenue, prev: roundTo(prevRevenue, 2), diff: diff(summary.totalRevenue, roundTo(prevRevenue, 2)), tag: diffTag(diff(summary.totalRevenue, roundTo(prevRevenue, 2))) },
      profit: { cur: summary.totalProfit, prev: roundTo(prevProfit, 2), diff: diff(summary.totalProfit, roundTo(prevProfit, 2)), tag: diffTag(diff(summary.totalProfit, roundTo(prevProfit, 2))) },
      curBest: bestSeller?.name || '-',
      prevBest: prevBestName,
    };
  }, [startTs, endTs, saleRecords, summary, bestSeller]);

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

  const isToday = startDate === todayStr() && endDate === todayStr();

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
        <View className={classnames(styles.qrBtn, isToday && styles.qrActive)} onClick={() => quickRange(1)}>今天</View>
        <View className={classnames(styles.qrBtn, !isToday && startDate !== todayStr() && styles.qrActive)} onClick={() => quickRange(7)}>近7天</View>
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

            {/* 时段对比 */}
            <View className={styles.compareCard}>
              <View className={styles.cpTitle}>📈 时段对比</View>
              <View className={styles.cpHeader}>
                <Text className={styles.cpCol} />
                <Text className={styles.cpCol}>{comparison.curRangeLabel}</Text>
                <Text className={styles.cpCol}>{comparison.prevRangeLabel}</Text>
                <Text className={styles.cpCol}>变化</Text>
              </View>
              <View className={styles.cpRow}>
                <Text className={styles.cpLabel}>出杯</Text>
                <Text className={styles.cpVal}>{comparison.cups.cur}</Text>
                <Text className={styles.cpVal}>{comparison.cups.prev}</Text>
                <Text className={classnames(styles.cpVal, comparison.cups.diff > 0 ? styles.cpUp : comparison.cups.diff < 0 ? styles.cpDown : styles.cpFlat)}>
                  {comparison.cups.tag}
                </Text>
              </View>
              <View className={styles.cpRow}>
                <Text className={styles.cpLabel}>营收</Text>
                <Text className={styles.cpVal}>¥{comparison.revenue.cur}</Text>
                <Text className={styles.cpVal}>¥{comparison.revenue.prev}</Text>
                <Text className={classnames(styles.cpVal, comparison.revenue.diff > 0 ? styles.cpUp : comparison.revenue.diff < 0 ? styles.cpDown : styles.cpFlat)}>
                  {comparison.revenue.tag}
                </Text>
              </View>
              <View className={styles.cpRow}>
                <Text className={styles.cpLabel}>毛利</Text>
                <Text className={styles.cpVal}>¥{comparison.profit.cur}</Text>
                <Text className={styles.cpVal}>¥{comparison.profit.prev}</Text>
                <Text className={classnames(styles.cpVal, comparison.profit.diff > 0 ? styles.cpUp : comparison.profit.diff < 0 ? styles.cpDown : styles.cpFlat)}>
                  {comparison.profit.tag}
                </Text>
              </View>
              <View className={styles.cpRow}>
                <Text className={styles.cpLabel}>热销</Text>
                <Text className={classnames(styles.cpVal, styles.cpBold)}>{comparison.curBest}</Text>
                <Text className={classnames(styles.cpVal, styles.cpBold)}>{comparison.prevBest}</Text>
                <Text className={styles.cpVal}>-</Text>
              </View>
            </View>

            <View className={styles.sectionTitle}>共 {summary.orderCount} 笔订单，{summary.totalCups} 杯</View>

            {filteredRecords.map((record) => {
              if (record.type === 'init') {
                return (
                  <View key={record.id} className={styles.initCard}>
                    <View style={{ fontSize: 28, marginRight: 12 }}>🔄</View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 26, fontWeight: '500', color: '#333', display: 'block' }}>{record.productName}</Text>
                      <Text style={{ fontSize: 22, color: '#A09A94', marginTop: 4, display: 'block' }}>
                        {formatDate(record.createdAt)} {formatTime(record.createdAt)} · 所有数据已重置为默认演示数据
                      </Text>
                    </View>
                  </View>
                );
              }
              const cat = getCategory(record.productId);
              const catColor = cat ? categoryColors[cat] : null;
              const recordIsToday = new Date(record.createdAt).toDateString() === new Date().toDateString();
              return (
                <View key={record.id} className={styles.recordCard}>
                  <View className={styles.rcTop}>
                    <Text className={styles.rcName}>{record.productName}</Text>
                    <Text className={styles.rcTime}>{recordIsToday ? formatTime(record.createdAt) : `${formatDate(record.createdAt)} ${formatTime(record.createdAt)}`}</Text>
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
