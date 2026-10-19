export const FRICTION = 110;

export function coast(speed: number, seconds: number, friction = FRICTION): { speed: number; distance: number } {
  // Трение замедляет машину до нуля в любом направлении.
  const direction = Math.sign(speed);
  const absoluteSpeed = Math.abs(speed);
  const movingSeconds = Math.min(seconds, absoluteSpeed / friction);
  return {
    speed: direction * Math.max(0, absoluteSpeed - friction * seconds),
    distance: direction * (absoluteSpeed * movingSeconds - friction * movingSeconds * movingSeconds / 2),
  };
}
