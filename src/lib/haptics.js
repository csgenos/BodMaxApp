// Haptic feedback via the Vibration API (silently no-ops on unsupported devices)
const v = (pattern) => navigator.vibrate?.(pattern)

export const haptic = {
  light:   () => v(8),
  medium:  () => v(20),
  heavy:   () => v(40),
  success: () => v([10, 60, 10]),
  error:   () => v([40, 30, 40]),
  pr:      () => v([10, 40, 10, 40, 80]),   // celebration burst
  timer:   () => v([30, 80, 30, 80, 120]),  // rest timer done
}
