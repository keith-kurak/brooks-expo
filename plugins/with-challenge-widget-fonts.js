/** @ref LLP 0008#weekly-challenge-implementation — Widget extensions need their own font resources. */
const { IOSConfig, withFinalizedMod } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('fs');
const path = require('path');

const FONTS = ['FilsonProRegular.otf', 'FilsonProMedium.otf', 'FilsonProBold.otf', 'FilsonProBlack.otf'];

module.exports = function withChallengeWidgetFonts(config) {
  return withFinalizedMod(config, ['ios', config => {
    const project = IOSConfig.XcodeUtils.getPbxproj(config.modRequest.projectRoot);
    const target = Object.entries(project.pbxNativeTargetSection()).find(([key, value]) =>
      !key.endsWith('_comment') && value.name.replaceAll('"', '') === 'ExpoWidgetsTarget');
    if (!target) throw new Error('Weekly challenge: ExpoWidgetsTarget is missing.');
    const [targetUuid, widgetTarget] = target;
    const root = config.modRequest.platformProjectRoot;
    // expo-widgets creates no Resources phase. xcode's helper silently falls
    // back to the app's phase when the requested extension has none.
    const phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
    if (!widgetTarget.buildPhases.some(phase => phases[phase.value])) {
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    }
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'ChallengeWidgetFonts');
    for (const name of FONTS) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.relative(root, path.join(config.modRequest.projectRoot, 'assets/fonts', name)),
        groupName: 'ChallengeWidgetFonts', project, targetUuid, isBuildFile: true,
      });
    }
    // Also repair an incremental prebuild from the earlier missing-phase
    // configuration. Only this plugin's font group is moved.
    const resources = project.hash.project.objects.PBXResourcesBuildPhase;
    const widgetResources = widgetTarget.buildPhases.map(phase => resources[phase.value]).find(Boolean);
    const group = Object.values(project.hash.project.objects.PBXGroup).find(value =>
      typeof value === 'object' && value.name?.replaceAll('"', '') === 'ChallengeWidgetFonts');
    const fontRefs = new Set(group.children.map(file => file.value));
    const builds = project.hash.project.objects.PBXBuildFile;
    const fontBuilds = Object.entries(builds).filter(([id, value]) =>
      !id.endsWith('_comment') && fontRefs.has(value.fileRef));
    for (const phase of Object.values(resources)) {
      if (typeof phase !== 'object' || phase === widgetResources) continue;
      phase.files = phase.files.filter(file => !fontRefs.has(builds[file.value]?.fileRef));
    }
    for (const [id, build] of fontBuilds) {
      if (!widgetResources.files.some(file => file.value === id)) {
        widgetResources.files.push({ value: id, comment: `${build.fileRef_comment} in Resources` });
      }
    }
    const infoPath = path.join(root, 'ExpoWidgetsTarget/Info.plist');
    const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
    info.UIAppFonts = [...new Set([...(info.UIAppFonts ?? []), ...FONTS])];
    fs.writeFileSync(infoPath, plist.build(info));
    fs.writeFileSync(project.filepath, project.writeSync());
    return config;
  }]);
};
