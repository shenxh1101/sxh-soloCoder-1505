import React, { useState, useMemo } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { formatPrice, roundTo } from '@/utils';
import type { UnitType } from '@/types';
import styles from './index.module.scss';

const categoryOptions = [
  '乳制品',
  '茶底',
  '糖浆',
  '配料',
  '水果',
  '咖啡',
  '其他',
];

const unitOptions: Array<{ key: UnitType; label: string }> = [
  { key: 'g', label: '克 (g)' },
  { key: 'ml', label: '毫升 (ml)' },
];

const IngredientEditPage: React.FC = () => {
  const router = useRouter();
  const ingredientId = router.params.id as string | undefined;

  const getIngredientById = useAppStore((s) => s.getIngredientById);
  const addIngredient = useAppStore((s) => s.addIngredient);
  const updateIngredient = useAppStore((s) => s.updateIngredient);

  const existing = useMemo(() => (ingredientId ? getIngredientById(ingredientId) : undefined), [ingredientId, getIngredientById]);
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name || '');
  const [category, setCategory] = useState(existing?.category || categoryOptions[0]);
  const [unit, setUnit] = useState<UnitType>(existing?.unit || 'ml');
  const [pricePerUnit, setPricePerUnit] = useState<string>(existing?.pricePerUnit.toString() || '');
  const [stock, setStock] = useState<string>(existing?.stock.toString() || '');
  const [warningThreshold, setWarningThreshold] = useState<string>(existing?.warningThreshold.toString() || '');

  const calcInfo = useMemo(() => {
    const price = parseFloat(pricePerUnit) || 0;
    const stockNum = parseFloat(stock) || 0;
    const costPer100 = roundTo(price * 100, 2);
    const stockValue = roundTo(price * stockNum, 2);
    return { costPer100, stockValue };
  }, [pricePerUnit, stock]);

  const handleSave = () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入原料名称', icon: 'none' });
      return;
    }
    const priceNum = parseFloat(pricePerUnit);
    if (isNaN(priceNum) || priceNum <= 0) {
      Taro.showToast({ title: '请输入正确的单价', icon: 'none' });
      return;
    }
    const stockNum = parseFloat(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      Taro.showToast({ title: '请输入正确的库存', icon: 'none' });
      return;
    }
    const thresholdNum = parseFloat(warningThreshold);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      Taro.showToast({ title: '请输入正确的预警阈值', icon: 'none' });
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      unit,
      pricePerUnit: priceNum,
      stock: stockNum,
      warningThreshold: thresholdNum,
    };

    if (isEdit && existing) {
      updateIngredient(existing.id, payload);
      Taro.showToast({ title: '原料更新成功', icon: 'success' });
    } else {
      addIngredient(payload);
      Taro.showToast({ title: '原料创建成功', icon: 'success' });
    }
    setTimeout(() => Taro.navigateBack(), 1200);
  };

  const handleCancel = () => {
    Taro.navigateBack();
  };

  return (
    <View>
      <ScrollView scrollY className={`pageContainer ${styles.pageContent}`}>
        {/* 基础信息 */}
        <View className={styles.formCard}>
          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>原料名称 *</Text>
            <Input
              className={styles.textInput}
              placeholder="例如：全脂牛奶、红茶茶底"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              maxlength={20}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>原料分类 *</Text>
            <View className={styles.tagList}>
              {categoryOptions.map((c) => (
                <View
                  key={c}
                  className={classnames(styles.tagItem, category === c && styles.active)}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 计量与价格 */}
        <View className={styles.formCard}>
          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>计量单位 *</Text>
            <View className={styles.unitRow}>
              {unitOptions.map((u) => (
                <View
                  key={u.key}
                  className={classnames(styles.unitOption, unit === u.key && styles.active)}
                  onClick={() => setUnit(u.key)}
                >
                  {u.label}
                </View>
              ))}
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>单价 (元/{unit}) *</Text>
            <View className={styles.inputWithUnit}>
              <Input
                className={styles.textInput}
                type="digit"
                placeholder={`例如：0.008（即每${unit}的价格）`}
                value={pricePerUnit}
                onInput={(e) => setPricePerUnit(e.detail.value)}
              />
              <Text className={styles.unitText}>元/{unit}</Text>
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>当前库存 ({unit})</Text>
            <View className={styles.inputWithUnit}>
              <Input
                className={styles.textInput}
                type="digit"
                placeholder={`例如：5000`}
                value={stock}
                onInput={(e) => setStock(e.detail.value)}
              />
              <Text className={styles.unitText}>{unit}</Text>
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>预警阈值 ({unit})</Text>
            <View className={styles.inputWithUnit}>
              <Input
                className={styles.textInput}
                type="digit"
                placeholder={`库存低于此值将提醒补货，例如：1000`}
                value={warningThreshold}
                onInput={(e) => setWarningThreshold(e.detail.value)}
              />
              <Text className={styles.unitText}>{unit}</Text>
            </View>
          </View>
        </View>

        {/* 实时信息 */}
        <View className={styles.formCard}>
          <View className="sectionTitle" style={{ marginBottom: '16rpx' }}>
            <Text>📊 实时信息</Text>
          </View>
          <View className={styles.infoCard}>
            <View className={styles.infoGrid}>
              <View className={styles.infoItem}>
                <Text className={styles.infoLabel}>每 100{unit} 成本</Text>
                <Text className={`${styles.infoValue} ${styles.cost}`}>{formatPrice(calcInfo.costPer100)}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.infoLabel}>每 1000{unit} 成本</Text>
                <Text className={`${styles.infoValue} ${styles.cost}`}>{formatPrice(calcInfo.costPer100 * 10)}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.infoLabel}>当前库存</Text>
                <Text className={`${styles.infoValue} ${styles.stock}`}>{(parseFloat(stock) || 0)} {unit}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.infoLabel}>库存总价值</Text>
                <Text className={styles.infoValue}>{formatPrice(calcInfo.stockValue)}</Text>
              </View>
            </View>
            <View className={styles.tip}>
              💡 建议：设置预警阈值 = 平时 2~3 天的用量。例如每天用500ml牛奶，就设 1000~1500ml 为预警线。
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View className={styles.bottomBar}>
        <View className={`${styles.btn} ${styles.cancel}`} onClick={handleCancel}>
          取消
        </View>
        <View className={`${styles.btn} ${styles.save}`} onClick={handleSave}>
          💾 {isEdit ? '保存修改' : '创建原料'}
        </View>
      </View>
    </View>
  );
};

export default IngredientEditPage;
