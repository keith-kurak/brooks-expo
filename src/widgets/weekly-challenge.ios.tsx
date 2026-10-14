import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor,
  monospacedDigit, resizable, tint, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { requireOptionalNativeModule } from 'expo';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import type { Widget, WidgetEnvironment } from 'expo-widgets';

import type { WeeklyChallengeWidgetProps } from './weekly-challenge.types';

interface WidgetProps extends WeeklyChallengeWidgetProps {
  progressBadge: string;
  completeBadge: string;
}

/** @ref LLP 0008#weekly-challenge-implementation — Pure presentation of the app's latest aggregate. */
const WeeklyChallenge = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const NAVY = '#14295F';
  const WHITE = '#FFFFFF';
  const LIME = '#ECF000';
  const complete = props.phase === 'complete';
  const active = props.phase !== 'invitation' && environment.date.getTime() < props.expiresAt;
  const badge = complete ? props.completeBadge : props.progressBadge;

  if (!active) {
    return (
      <VStack alignment="leading" spacing={8} modifiers={[containerBackground(NAVY, 'widget'), widgetURL(props.url), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'leading' })]}>
        <Text modifiers={[font({ family: 'FilsonPro-Bold', size: 14 }), foregroundStyle(WHITE)]}>Weekly 5K</Text>
        <Text modifiers={[font({ family: 'FilsonPro-Black', size: 26 }), foregroundStyle(WHITE), lineLimit(2)]}>Run 5 km this week.</Text>
        <Text modifiers={[font({ family: 'FilsonPro-Medium', size: 12 }), foregroundStyle(WHITE)]}>Join in Brooks</Text>
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={8} modifiers={[containerBackground(NAVY, 'widget'), widgetURL(props.url), frame({ maxWidth: 10000, maxHeight: 10000 })]}>
      <HStack>
        <Text modifiers={[font({ family: 'FilsonPro-Bold', size: 14 }), foregroundStyle(WHITE), lineLimit(1)]}>Weekly 5K</Text>
        <Spacer />
        <Text modifiers={[font({ family: 'FilsonPro-Regular', size: 12 }), foregroundStyle(WHITE), lineLimit(1)]}>{complete ? 'Complete' : 'Ends Sunday'}</Text>
      </HStack>
      <HStack spacing={12} modifiers={[frame({ maxHeight: 10000 })]}>
        <HStack alignment="firstTextBaseline" spacing={6}>
          <Text modifiers={[font({ family: 'FilsonPro-Black', size: 48 }), foregroundStyle(WHITE), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.65)]}>{props.distance}</Text>
          <Text modifiers={[font({ family: 'FilsonPro-Medium', size: 17 }), foregroundStyle(WHITE), lineLimit(1)]}>/ 5 km</Text>
        </HStack>
        <Spacer />
        {badge ? <Image uiImage={badge} modifiers={[resizable(), frame({ width: 56, height: 56 })]} /> : <Image systemName={complete ? 'checkmark.seal' : 'hexagon'} color={complete ? LIME : WHITE} size={42} />}
      </HStack>
      <ProgressView value={props.share} modifiers={[tint(LIME), frame({ maxWidth: 10000, height: 6 })]} />
      <HStack>
        <Text modifiers={[font({ family: complete ? 'FilsonPro-Bold' : 'FilsonPro-Medium', size: 12 }), foregroundStyle(complete ? LIME : WHITE), lineLimit(1)]}>{complete ? '1 entry earned' : props.remaining}</Text>
        <Spacer />
        <Text modifiers={[font({ family: 'FilsonPro-Regular', size: 12 }), foregroundStyle(WHITE), lineLimit(1)]}>{props.runsLabel}</Text>
      </HStack>
    </VStack>
  );
};

const native = requireOptionalNativeModule<{ widgetsDirectory: string | null }>('ExpoWidgets');
const widget: Widget<WidgetProps> | null = native
  ? (require('expo-widgets') as typeof import('expo-widgets')).createWidget<WidgetProps>('WeeklyChallenge', WeeklyChallenge)
  : null;
let latest: WeeklyChallengeWidgetProps | null = null;
let badges = { progressBadge: '', completeBadge: '' };
let lastPublished = '';

/** Schedule an invitation at Monday midnight so last week's completion cannot linger. */
function publish() {
  if (!widget || !latest) return;
  const props = { ...latest, ...badges };
  const fingerprint = JSON.stringify(props);
  if (fingerprint === lastPublished) return;
  widget.updateTimeline([
    { date: new Date(), props },
    { date: new Date(Math.max(Date.now() + 1000, props.expiresAt)), props: { ...props, phase: 'invitation', share: 0, distance: '0.0', runsLabel: '0 runs' } },
  ]);
  lastPublished = fingerprint;
}

// Images must be copied to the shared App Group, not left in the app's sandbox.
if (native?.widgetsDirectory) {
  const directory = new Directory(native.widgetsDirectory);
  Promise.all([
    require('../../assets/challenges/weekly-5k.png'),
    require('../../assets/challenges/weekly-5k-complete.png'),
  ].map(async (source: number, index) => {
    const asset = await Asset.fromModule(source).downloadAsync();
    if (!asset.localUri) return '';
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `weekly-5k-${index}.png`);
    if (!file.exists) new File(asset.localUri).copy(file);
    return file.uri;
  })).then(([progressBadge, completeBadge]) => {
    badges = { progressBadge, completeBadge };
    publish();
  }).catch(() => { /* The native symbol remains available if copying an asset fails. */ });
}

export function updateWeeklyChallengeWidget(props: WeeklyChallengeWidgetProps): void {
  latest = props;
  publish();
}
