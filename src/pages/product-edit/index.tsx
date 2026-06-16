import React, { useState, useMemo } from 'react';
import { View, Text, Input, Picker, Textarea, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useAppStore } from '@/store';
import { categoryLabels, formatPrice, calculateSuggestedPrice, roundTo } from '@/utils';
import type { ProductCategory, RecipeItem } from '@/types';
import styles from './index.module.scss';

interface RecipeRow extends RecipeItem {
  ingredientId: string;
  amount: number;
}

const catOptions: Array<{ key: ProductCategory; label: string }> = [
  { key: 'milk_tea', label: '奶茶' },
  { key: 'fruit_tea', label: '果茶' },
  { key: 'coffee', label: '咖啡' },
];

const ProductEditPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id as string | undefined;

  const ingredients = useAppStore((s) => s.ingredients);
  const getProductById = useAppStore((s) => s.getProductById);
  const addProduct = useAppStore((s) => s.addProduct);
  const updateProduct = useAppStore((s) => s.updateProduct);

  const existingProduct = useMemo(() => (productId ? getProductById(productId) : undefined), [productId, getProductById]);
  const isEdit = !!existingProduct;

  const [name, setName] = useState(existingProduct?.name || '');
  const [category, setCategory] = useState<ProductCategory>(existingProduct?.category || 'milk_tea');
  const [sellingPrice, setSellingPrice] = useState<string>(existingProduct?.sellingPrice.toString() || '');
  const [description, setDescription] = useState(existingProduct?.description || '');
  const [recipe, setRecipe] = useState<RecipeRow[]>(() => {
    if (existingProduct && existingProduct.recipe.length > 0) {
      return existingProduct.recipe.map((r) => ({ ...r }));
    }
    return [{ ingredientId: ingredients[0]?.id || '', amount: 100 }];
  });

  const calcInfo = useMemo(() => {
    let totalCost = 0;
    const items = recipe.map((r, idx) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      const cost = ing ? ing.pricePerUnit * r.amount : 0;
      totalCost += cost;
      return { idx, ingredient: ing, cost: roundTo(cost, 4) };
    });
    totalCost = roundTo(totalCost, 4);
    const priceNum = parseFloat(sellingPrice) || 0;
    const profit = roundTo(priceNum - totalCost, 2);
    const profitRate = priceNum > 0 ? roundTo((profit / priceNum) * 100, 0) : 0;
    const suggested = calculateSuggestedPrice(totalCost, 0.66);
    return { totalCost, items, profit, profitRate, suggested };
  }, [recipe, ingredients, sellingPrice]);

  const ingredientOptions = ingredients.map((i) => i.name);

  const addRecipeRow = () => {
    const used = new Set(recipe.map((r) => r.ingredientId));
    const available = ingredients.find((i) => !used.has(i.id));
    if (available) {
      setRecipe([...recipe, { ingredientId: available.id, amount: 50 }]);
    } else {
      Taro.showToast({ title: '所有原料已使用', icon: 'none' });
    }
  };

  const removeRecipeRow = (idx: number) => {
    if (recipe.length <= 1) return;
    setRecipe(recipe.filter((_, i) => i !== idx));
  };

  const updateRecipeIng = (idx: number, ingIdx: number) => {
    const targetId = ingredients[ingIdx]?.id || '';
    if (!targetId) return;
    const isDuplicate = recipe.some((r, i) => i !== idx && r.ingredientId === targetId);
    if (isDuplicate) {
      const ingName = ingredients[ingIdx]?.name || '';
      Taro.showToast({ title: `${ingName} 已在配方中`, icon: 'none' });
      return;
    }
    const arr = [...recipe];
    arr[idx] = { ...arr[idx], ingredientId: targetId };
    setRecipe(arr);
  };

  const updateRecipeAmt = (idx: number, val: string) => {
    const n = parseFloat(val) || 0;
    const arr = [...recipe];
    arr[idx] = { ...arr[idx], amount: n };
    setRecipe(arr);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Taro.showToast({ title: '请输入正确的售价', icon: 'none' });
      return;
    }
    const validRecipe = recipe.filter((r) => r.ingredientId && r.amount > 0);
    if (validRecipe.length === 0) {
      Taro.showToast({ title: '请至少配置1种原料', icon: 'none' });
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      sellingPrice: priceNum,
      description: description.trim(),
      recipe: validRecipe,
    };

    if (isEdit && existingProduct) {
      updateProduct(existingProduct.id, payload);
      Taro.showToast({ title: '产品更新成功', icon: 'success' });
    } else {
      addProduct(payload);
      Taro.showToast({ title: '产品创建成功', icon: 'success' });
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
            <Text className={styles.rowLabel}>产品名称 *</Text>
            <Input
              className={styles.textInput}
              placeholder="例如：经典珍珠奶茶"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              maxlength={30}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>产品分类 *</Text>
            <View className={styles.tagList}>
              {catOptions.map((c) => (
                <View
                  key={c.key}
                  className={classnames(styles.tagItem, category === c.key && styles.active, category === c.key && styles[c.key])}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label}
                </View>
              ))}
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>售价 (元) *</Text>
            <View className={styles.inputWithUnit}>
              <Input
                className={styles.textInput}
                type="digit"
                placeholder="例如：12.00"
                value={sellingPrice}
                onInput={(e) => setSellingPrice(e.detail.value)}
              />
              <Text className={styles.unitText}>元/杯</Text>
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.rowLabel}>产品描述</Text>
            <Textarea
              className={styles.textArea}
              placeholder="介绍下这款产品的特点、风味等..."
              value={description}
              onInput={(e) => setDescription(e.detail.value)}
              maxlength={100}
            />
          </View>
        </View>

        {/* 配方配置 */}
        <View className={styles.formCard}>
          <View className={styles.recipeSection}>
            <View className={styles.recipeHeader}>
              <Text className={styles.recipeTitle}>🧪 配方配置 *</Text>
              <View className={styles.addBtn} onClick={addRecipeRow}>+ 添加原料</View>
            </View>
          </View>

          {recipe.map((r, idx) => {
            const info = calcInfo.items[idx];
            const ing = info?.ingredient;
            const ingIdx = ingredients.findIndex((i) => i.id === r.ingredientId);
            return (
              <View key={idx} className={styles.recipeItem}>
                <Picker
                  range={ingredientOptions}
                  value={ingIdx >= 0 ? ingIdx : 0}
                  onChange={(e) => updateRecipeIng(idx, Number(e.detail.value))}
                >
                  <View className={styles.riPicker}>
                    <Text className={styles.riPickerText}>{ing?.name || '选原料'}</Text>
                    <Text style={{ fontSize: 20, color: '#A09A94', flexShrink: 0 }}>▼</Text>
                  </View>
                </Picker>
                <Input
                  className={styles.riInput}
                  type="digit"
                  value={r.amount.toString()}
                  onInput={(e) => updateRecipeAmt(idx, e.detail.value)}
                />
                <Text className={styles.riUnit}>{ing?.unit || 'g'}</Text>
                <Text className={styles.riCost}>¥{info?.cost || '0'}</Text>
                <View className={styles.riRemove} onClick={() => removeRecipeRow(idx)}>×</View>
              </View>
            );
          })}
        </View>

        {/* 实时计算 */}
        <View className={styles.formCard}>
          <View className={classnames('sectionTitle')} style={{ marginBottom: '16rpx' }}>
            <Text>📊 实时成本计算</Text>
          </View>
          <View className={styles.calcResult}>
            <View className={styles.resultRow}>
              <Text className={styles.rLabel}>物料总成本</Text>
              <Text className={`${styles.rValue} ${styles.cost}`}>{formatPrice(calcInfo.totalCost)}</Text>
            </View>
            <View className={styles.resultRow}>
              <Text className={styles.rLabel}>建议售价 (66%毛利)</Text>
              <Text className={`${styles.rValue} ${styles.price}`}>{formatPrice(calcInfo.suggested)}</Text>
            </View>
            {sellingPrice && (
              <>
                <View className={styles.resultRow}>
                  <Text className={styles.rLabel}>单杯毛利</Text>
                  <Text className={classnames(styles.rValue, calcInfo.profit >= 0 ? styles.profit : styles.cost)}>
                    {formatPrice(calcInfo.profit)}
                  </Text>
                </View>
                <View className={styles.resultRow} style={{ paddingTop: '16rpx', border: 'none' }}>
                  <Text className={styles.rLabel}>实际毛利率</Text>
                  <Text className={`${styles.rBig} ${styles.profit}`}>{calcInfo.profitRate}%</Text>
                </View>
              </>
            )}
            <View className={styles.tip}>
              💡 毛利率参考：街边店50~60%，品牌店65~75%。可根据地区消费水平调整。
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
          💾 {isEdit ? '保存修改' : '创建产品'}
        </View>
      </View>
    </View>
  );
};

export default ProductEditPage;
