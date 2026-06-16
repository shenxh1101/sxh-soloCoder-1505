import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { roundTo } from '@/utils';
import type { StockLogType } from '@/types';
import styles from './index.module.scss';

const typeLabelMap: Record<StockLogType, string> = {
  restock: '补货入库',
  sale_deduct: '制作扣料',
  manual_edit: '手动修改',
  adjust: '库存调整',
  init: '系统初始化',
};

const typeIconMap: Record<StockLogType, string> = {
  restock: '📥',
  sale_deduct: '🥤',
  manual_edit: '✏️',
  adjust: '🔄',
  init: '🔄',
};

type FilterType = 'all' | StockLogType;

const filterOptions: Array<{ key: FilterType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'restock', label: '补货' },
  { key: 'sale_deduct', label: '扣料' },
  { key: 'manual_edit', label: '修改' },
];

const StockLogsPage: React.FC = () => {
  const stockLogs = useAppStore((s) => s.stockLogs);
  const ingredients = useAppStore((s) => s.ingredients);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [filterIngId, setFilterIngId] = useState<string>('all');

  const dateStart = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }, [selectedDate]);

  const dateEnd = useMemo(() => dateStart + 86400000, [dateStart]);

  const ingredientOptions = useMemo(() => ['全部原料', ...ingredients.map((i) => i.name)], [ingredients]);
  const currentIngIdx = filterIngId === 'all' ? 0 : ingredients.findIndex((i) => i.id === filterIngId) + 1;

  const dayLogs = useMemo(() => {
    return stockLogs
      .filter((log) => {
        if (log.createdAt < dateStart || log.createdAt >= dateEnd) return false;
        if (activeFilter !== 'all' && log.type !== activeFilter) return false;
        if (filterIngId !== 'all' && log.ingredientId !== filterIngId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [stockLogs, dateStart, dateEnd, activeFilter, filterIngId]);

  const daySummary = useMemo(() => {
    let restockTotal = 0;
    let deductTotal = 0;
    let recordCount = 0;
    dayLogs.forEach((log) => {
      if (log.type === 'init') return;
      if (log.changeAmount > 0) restockTotal += log.changeAmount;
      else deductTotal += Math.abs(log.changeAmount);
      recordCount++;
    });
    return { restockTotal: roundTo(restockTotal, 1), deductTotal: roundTo(deductTotal, 1), count: recordCount };
  }, [dayLogs]);

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

  const isToday = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return selectedDate === todayStr;
  };

  const formatDisplayDate = () => {
    const [y, m, d] = selectedDate.split('-');
    if (isToday()) return `今天 (${m}月${d}日)`;
    return `${m}月${d}日`;
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const handleCopyText = () => {
    if (dayLogs.length === 0) {
      Taro.showToast({ title: '无数据可复制', icon: 'none' });
      return;
    }
    const [y, m, d] = selectedDate.split('-');
    const ingName = filterIngId !== 'all' ? ` · ${ingredients.find((i) => i.id === filterIngId)?.name || ''}` : '';
    let text = `📊 库存对账单 - ${m}月${d}日${ingName}\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `入库：${daySummary.restockTotal}  出库：${daySummary.deductTotal}  笔数：${daySummary.count}\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    dayLogs.forEach((log) => {
      const time = formatTime(log.createdAt);
      const change = log.changeAmount > 0 ? `+${log.changeAmount}` : `${log.changeAmount}`;
      text += `${time} ${log.ingredientName} ${typeLabelMap[log.type]} ${change}${log.unit} (${log.stockBefore}→${log.stockAfter}) ${log.source}\n`;
    });
    Taro.setClipboardData({ data: text, success: () => Taro.showToast({ title: '对账文本已复制', icon: 'success' }) });
  };

  const handleIngFilterChange = (e: any) => {
    const idx = Number(e.detail.value);
    if (idx === 0) setFilterIngId('all');
    else setFilterIngId(ingredients[idx - 1]?.id || 'all');
  };

  return (
    <View>
      <View className={styles.filterBar}>
        <View className={styles.datePicker}>
          <View className={styles.dateNav} onClick={handlePrevDay}>‹</View>
          <Text className={styles.dateText}>{formatDisplayDate()}</Text>
          <View className={styles.dateNav} onClick={handleNextDay}>›</View>
        </View>
        <View className={styles.topActions}>
          <Picker range={ingredientOptions} value={currentIngIdx} onChange={handleIngFilterChange}>
            <View className={styles.ingFilterBtn}>
              {filterIngId === 'all' ? '全部原料' : ingredients.find((i) => i.id === filterIngId)?.name || '全部原料'}
              <Text style={{ fontSize: 18, marginLeft: 4 }}>▼</Text>
            </View>
          </Picker>
          <View className={styles.copyBtn} onClick={handleCopyText}>
            📋 复制对账
          </View>
        </View>
      </View>

      <View className={styles.typeFilter}>
        {filterOptions.map((opt) => (
          <View
            key={opt.key}
            className={classnames(styles.typeBtn, activeFilter === opt.key && styles.active)}
            onClick={() => setActiveFilter(opt.key)}
          >
            {opt.label}
          </View>
        ))}
      </View>

      <ScrollView scrollY className={styles.pageContainer} style={{ height: 'calc(100vh - 260rpx)' }}>
        {dayLogs.length === 0 ? (
          <View className={styles.emptyWrapper}>
            <View className={styles.emptyIcon}>📋</View>
            <Text className={styles.emptyText}>
              {isToday() ? '今天还没有库存变动记录' : '当天没有库存变动记录'}
              {'\n'}
              补货、制作饮品后会自动记录
            </Text>
          </View>
        ) : (
          <View>
            <View className={styles.summaryCard}>
              <View className={styles.summaryItem}>
                <Text className={styles.sLabel}>入库总量</Text>
                <Text className={styles.sValue}>{daySummary.restockTotal}</Text>
              </View>
              <View className={styles.summaryItem}>
                <Text className={styles.sLabel}>出库总量</Text>
                <Text className={styles.sValue}>{daySummary.deductTotal}</Text>
              </View>
              <View className={styles.summaryItem}>
                <Text className={styles.sLabel}>变动笔数</Text>
                <Text className={styles.sValue}>{daySummary.count}</Text>
              </View>
            </View>

            <View className={styles.sectionTitle}>变动明细</View>

            {dayLogs.map((log) => {
              if (log.type === 'init') {
                return (
                  <View key={log.id} className={styles.initCard}>
                    <View style={{ fontSize: 28, marginRight: 12 }}>🔄</View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 26, fontWeight: '500', color: '#333', display: 'block' }}>{log.ingredientName}</Text>
                      <Text style={{ fontSize: 22, color: '#A09A94', marginTop: 4, display: 'block' }}>
                        {formatTime(log.createdAt)} · {log.source}
                      </Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={log.id} className={styles.logCard}>
                <View className={styles.logTop}>
                  <Text className={styles.logName}>
                    {typeIconMap[log.type]} {log.ingredientName}
                  </Text>
                  <Text className={styles.logTime}>{formatTime(log.createdAt)}</Text>
                </View>
                <View className={classnames(styles.logTypeTag, styles[log.type])}>
                  {typeLabelMap[log.type]}
                </View>
                <Text className={styles.logSource}>{log.source}</Text>
                <View className={styles.logBottom}>
                  <View className={styles.logStat}>
                    <Text className={styles.lsLabel}>变动</Text>
                    <Text className={classnames(styles.lsValue, log.changeAmount > 0 ? styles.changePositive : styles.changeNegative)}>
                      {log.changeAmount > 0 ? '+' : ''}{log.changeAmount}{log.unit}
                    </Text>
                  </View>
                  <View className={styles.logStat}>
                    <Text className={styles.lsLabel}>变动前</Text>
                    <Text className={styles.lsValue}>{log.stockBefore}{log.unit}</Text>
                  </View>
                  <View className={styles.logStat}>
                    <Text className={styles.lsLabel}>变动后</Text>
                    <Text className={styles.lsValue}>{log.stockAfter}{log.unit}</Text>
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

export default StockLogsPage;
