import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { BrooksIcon } from '@/components/icons';
import { Press } from '@/components/press';
import { ShoeImage } from '@/components/shoe-image';
import { Txt } from '@/components/themed-text';
import { GENDER_LABEL } from '@/data/labels';
import {
  DEFAULT_LIMIT,
  LIMIT_CHOICES,
  startOfDay,
} from '@/data/mileage';
import { catalog } from '@/data/catalog';
import { byId, colorwayOf } from '@/data/query';
import type { Product } from '@/data/types';
import { addShoe, refreshMileage } from '@/store/shoes';
import { border, colors, font, headerIcon, nativeSheetHeader, spacing } from '@/theme';

import type { WorkoutKind } from '../../../modules/brooks-activity/src/BrooksActivity.types';
import { SHOES } from './replacement';
import { StartDateField } from './start-date';
import { HEALTH_NAME, useHealthAccess } from '@/utils/health';

const DAY_MS = 24 * 60 * 60 * 1000;

const COUNTS: { label: string; kinds: WorkoutKind[] }[] = [
  { label: 'Runs', kinds: ['run'] },
  { label: 'Runs, walks and hikes', kinds: ['run', 'walk', 'hike'] },
];

/**
 * Adding a pair the runner owns.
 *
 * @ref LLP 0006#adding-a-pair — Four answers: which pair, when it started,
 * how many miles it already had, and its limit. The pair is picked from the
 * catalog, so its photo and its successor are known, or typed in, because the
 * pair on a runner's feet is often a model the store no longer sells. A PDP
 * opens the sheet with its own shoe already chosen.
 */
export function AddShoeSheet({ productId, colorCode }: { productId?: string; colorCode?: string }) {
  const insets = useSafeAreaInsets();
  const { access } = useHealthAccess();
  const HEALTH = access.status !== 'unavailable';
  const [product, setProduct] = useState<Product | null>(() => (productId ? byId(catalog, productId) ?? null : null));
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState<string | null>(null);
  // Two weeks ago: a pair is usually added after a few runs, not on its first day.
  const [startedAt, setStartedAt] = useState(() => startOfDay(Date.now() - 14 * DAY_MS));
  const [startMiles, setStartMiles] = useState('');
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [kinds, setKinds] = useState<WorkoutKind[]>(['run']);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SHOES.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const name = product?.name ?? customName;
  const miles = Number(startMiles.replace(/[^0-9.]/g, '')) || 0;

  const save = () => {
    if (!name) return;
    addShoe({
      productId: product?.id ?? null,
      colorCode: product ? colorwayOf(product, colorCode).code : null,
      name,
      startedAt,
      limitMiles: limit,
      startMiles: miles,
      kinds,
    });
    router.back();
    // The tap that added the pair is the tap that may show the Health sheet.
    refreshMileage({ ask: true });
  };

  return (
    <View collapsable={false} style={styles.root}>
      {nativeSheetHeader ? (
        <>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button icon={headerIcon.close} accessibilityLabel="Close" onPress={() => router.back()} />
          </Stack.Toolbar>
          {/* Keeps the scroll view off the sheet's first-subview chain, as in
              `Filter & sort`. */}
          <View collapsable={false} />
        </>
      ) : (
        <View style={styles.head}>
          <Txt variant="h2">Add a pair</Txt>
          <Press accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()}>
            <BrooksIcon name="closeThin" size={22} color={colors.ink} />
          </Press>
        </View>
      )}

      <View collapsable={false} style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentInsetAdjustmentBehavior={nativeSheetHeader ? 'automatic' : 'never'}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={spacing.xl}
        >
          <Label>Which pair?</Label>
          {name ? (
            <View style={styles.chosen}>
              {product ? (
                <View style={styles.thumb}>
                  <ShoeImage url={colorwayOf(product, colorCode).images[0]?.url ?? ''} width={56} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Txt variant="productTitle">{name}</Txt>
                {product?.gender ? (
                  <Txt variant="tiny" c={colors.inkMuted}>
                    {GENDER_LABEL[product.gender]}
                  </Txt>
                ) : null}
              </View>
              <Press
                hitSlop={10}
                accessibilityRole="button"
                onPress={() => {
                  setProduct(null);
                  setCustomName(null);
                }}
              >
                <Txt variant="caption" style={styles.underline}>
                  Change
                </Txt>
              </Press>
            </View>
          ) : (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search, e.g. Ghost 17"
                placeholderTextColor={colors.inkFaint}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel="Search for your pair"
                style={styles.input}
              />
              {matches.map((p) => (
                <Press key={p.id} style={styles.match} onPress={() => setProduct(p)} accessibilityRole="button">
                  <View style={styles.thumb}>
                    <ShoeImage url={p.colors[0]?.images[0]?.url ?? ''} width={56} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="productTitle">{p.name}</Txt>
                    {p.gender ? (
                      <Txt variant="tiny" c={colors.inkMuted}>
                        {GENDER_LABEL[p.gender]}
                      </Txt>
                    ) : null}
                  </View>
                </Press>
              ))}
              {query.trim() ? (
                <Press style={styles.match} onPress={() => setCustomName(query.trim())} accessibilityRole="button">
                  <View style={[styles.thumb, styles.plus]}>
                    <BrooksIcon name="plus" size={16} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="productTitle">Add “{query.trim()}”</Txt>
                    <Txt variant="tiny" c={colors.inkMuted}>
                      For a pair the store does not list
                    </Txt>
                  </View>
                </Press>
              ) : null}
            </>
          )}

          <Label>When did you start running in them?</Label>
          <StartDateField value={startedAt} onChange={setStartedAt} />

          <Label>Miles already on them</Label>
          <TextInput
            value={startMiles}
            onChangeText={setStartMiles}
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
            keyboardType="decimal-pad"
            accessibilityLabel="Miles already on them"
            style={styles.input}
          />
          <Txt variant="tiny" c={colors.inkMuted} style={{ marginTop: spacing.sm }}>
            {HEALTH
              ? `Only miles from before the start date, or from runs ${HEALTH_NAME} did not record.`
              : 'Every mile on them so far. Update the pair as you go.'}
          </Txt>

          <Label>Replace at</Label>
          <View style={styles.chips}>
            {LIMIT_CHOICES.map((value) => (
              <Chip key={value} label={`${value} mi`} selected={limit === value} onPress={() => setLimit(value)} />
            ))}
          </View>
          <Txt variant="tiny" c={colors.inkMuted} style={{ marginTop: spacing.sm }}>
            Most running shoes last 300 to 500 miles. Brooks tells you to replace them at 70%.
          </Txt>

          {HEALTH ? (
            <>
              <Label>{`Count from ${HEALTH_NAME}`}</Label>
              <View style={styles.chips}>
                {COUNTS.map((c) => (
                  <Chip
                    key={c.label}
                    label={c.label}
                    selected={kinds.length === c.kinds.length}
                    onPress={() => setKinds(c.kinds)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
        <Button title="Add pair" disabled={!name} onPress={save} />
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt variant="eyebrow" c={colors.inkMuted} style={styles.label}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  body: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm },
  input: {
    height: 50,
    borderWidth: border.rule,
    borderColor: colors.controlBorder,
    paddingHorizontal: spacing.md,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderWidth: border.emphasis,
    borderColor: colors.ink,
  },
  thumb: {
    width: 56,
    height: 56,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { backgroundColor: colors.surface, borderWidth: border.rule, borderColor: colors.controlBorder },
  underline: { textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
});
