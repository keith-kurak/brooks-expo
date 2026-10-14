import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Txt } from '@/components/themed-text';
import { colors, font } from '@/theme';

export function WeeklyBadge({ complete, size = 78 }: { complete: boolean; size?: number }) {
  return (
    <View accessibilityRole="image" accessibilityLabel={complete ? 'Weekly 5K badge earned' : 'Weekly 5K badge'}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 78 78" style={{ position: 'absolute' }}>
        <Path d="M39 2 73 20v38L39 76 5 58V20Z" fill="none" stroke={complete ? colors.lime : 'rgba(255,255,255,0.55)'} strokeWidth={1.5} />
        <Path d="M39 7 68 23v32L39 71 10 55V23Z" fill="none" stroke={complete ? 'rgba(236,240,0,0.55)' : 'rgba(255,255,255,0.22)'} />
        {complete && <><Circle cx={67} cy={65} r={11} fill={colors.lime} stroke={colors.navy} strokeWidth={2} /><Path d="m62 65 3 3 6-6" stroke={colors.navy} strokeWidth={1.8} fill="none" /></>}
      </Svg>
      <Txt c={colors.surface} style={{ fontFamily: font.black, fontSize: size * 27 / 78, lineHeight: size * 32 / 78, letterSpacing: -0.6 }}>5K</Txt>
    </View>
  );
}
