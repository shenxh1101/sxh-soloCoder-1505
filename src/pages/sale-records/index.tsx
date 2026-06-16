import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { formatPrice, categoryLabels, categoryColors } from '@/utils';
import type { ProductCategory, SaleRecord } from '@/types';
import styles from './index.module.scss';

const SaleRecordsPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.productId as string | undefined;
  const productName = router.params.productName as string | undefined;

  const saleRecords = useAppStore((s) => s.saleRecords);
  const products = useAppStore((s) => s.products);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [filterProductId, setFilterProductId] = useState<string | undefined>(productId);

  const dateStart = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }, [selectedDate]);

  const dateEnd = useMemo(() => dateStart + 86400000, [dateStart]);

  const dayRecords = useMemo(() => {
    return saleRecords.filter((r) => {
      if (r.createdAt < dateStart || r.createdAt >= dateEnd) return false;
      if (filterProductId && r.productId !== filterProductId) return false;
      return true;
    });
  }, [saleRecords, dateStart, dateEnd, filterProductId]);

  const daySummary = useMemo(() => {
    let totalCups = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    dayRecords.forEach((r) => {
      totalCups += r.quantity;
      totalRevenue += r.totalRevenue;
      totalCost += r.totalCost;
      totalProfit += r.totalProfit;
    });
    return { totalCups, totalRevenue, totalCost, totalProfit };
  }, [dayRecords]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date();
    if (d > today) {
      Taro.showToast({ title: '不能选择未来日期', icon: 'none' });
      return;
    }
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const productOptions = ['全部产品', ...products.map((p) => p.name)];
  const currentProductIdx = filterProductId
    ? products.findIndex((p) => p.id === filterProductId) + 1
    : 0;

  const handleProductChange = (e: any) => {
    const idx = Number(e.detail.value);
    if (idx === 0) {
      setFilterProductId(undefined);
    } else {
      setFilterProductId(products[idx - 1]?.id);
    }
  };

  const isToday = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return selectedDate === todayStr;
  };

  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    if (isToday()) return `今天 (${m}月${d}日)`;
    return `${m}月${d}日`;
  };

  const getCategory = (productId: string): ProductCategory | undefined => {
    return products.find((p) => p.id === productId)?.category;
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <View>
      <View className={styles.filterBar}>
        <View className={styles.datePicker}>
          <View className={styles.dateNav} onClick={handlePrevDay}>‹</View>
          <Text className={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
          <View className={styles.dateNav} onClick={handleNextDay}>›</View>
        </View>
        <Picker range={productOptions} value={currentProductIdx} onChange={handleProductChange}>
          <View className={styles.productFilter}>
            {productName || (filterProductId ? products.find((p) => p.id === filterProductId)?.name : '全部产品')}
            <Text className={styles.filterArrow}>▼</Text>
          </View>
        </Picker>
      </View>

      <ScrollView scrollY className={`${styles.pageContainer} pageContainer`}>
        {/* 当日汇总 */}
        <View style={{ padding: '0 32rpx 24rpx' }}>
          <View
            style={{
              background: 'linear-gradient(135deg, #FF8A50 0%, #FFB088 100%)',
              borderRadius: 16,
              padding: '32rpx',
              color: '#fff',
            }}
          >
            <Text style={{ fontSize: 24, opacity: 0.9 }}>当日汇总</Text>
            <View style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <View>
                <Text style={{ fontSize: 36, fontWeight: 'bold' }}>{daySummary.totalCups}</Text>
                <Text style={{ fontSize: 22, opacity: 0.85, marginLeft: 4 }}>杯</Text>
              </View>
              <View style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 22, opacity: 0.85 }}>营收</Text>
                <Text style={{ fontSize: 32, fontWeight: 'bold' }}>¥{daySummary.totalRevenue.toFixed(2)}</Text>
              </View>
            </View>
            <View style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1rpx solid rgba(255,255,255,0.3)' }}>
              <View>
                <Text style={{ fontSize: 22, opacity: 0.85 }}>成本</Text>
                <Text style={{ fontSize: 26, fontWeight: '600' }}>¥{daySummary.totalCost.toFixed(2)}</Text>
              </View>
              <View style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 22, opacity: 0.85 }}>毛利</Text>
                <Text style={{ fontSize: 26, fontWeight: '600' }}>¥{daySummary.totalProfit.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 记录列表 */}
        {dayRecords.length === 0 ? (
          <View className={styles.emptyWrapper}>
            <View className={styles.emptyIcon}>🥤</View>
            <Text className={styles.emptyText}>
              {isToday() ? '今天还没有销售记录哦～' : '当天没有销售记录'}
              {'\n'}
              去点单页卖几杯吧！
            </Text>
          </View>
        ) : (
          <View>
            <View className={styles.sectionTitle}>共 {dayRecords.length} 笔订单，{daySummary.totalCups} 杯</View>
            {dayRecords.map((record) => {
              const cat = getCategory(record.productId);
              const catColor = cat ? categoryColors[cat] : null;
              return (
                <View key={record.id} className={styles.recordCard}>
                  <View className={styles.rcTop}>
                    <Text className={styles.rcName}>{record.productName}</Text>
                    <Text className={styles.rcTime}>{formatTime(record.createdAt)}</Text>
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
                      <Text className={`${styles.rcValue} ${styles.profit}`}>
                        {formatPrice(record.totalProfit)}
                      </Text>
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
