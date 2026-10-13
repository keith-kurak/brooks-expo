Pod::Spec.new do |s|
  s.name           = 'BrooksActivity'
  s.version        = '1.0.0'
  s.summary        = 'Read-only Apple Health activity for the Brooks Shoe Finder'
  s.description    = 'Reads running, walking and hiking workouts and daily step totals from HealthKit.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # HealthKit has no tvOS counterpart.
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
