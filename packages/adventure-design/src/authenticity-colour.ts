export const validHexColour = (value: string): boolean => /^#[0-9a-f]{6}$/iu.test(value);

const rgb = (value: string): readonly [number, number, number] | null => {
  if (!validHexColour(value)) return null;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
};

const linearChannel = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const colourLuminance = (value: string): number | null => {
  const colour = rgb(value);
  if (!colour) return null;
  return (
    0.2126 * linearChannel(colour[0]) + 0.7152 * linearChannel(colour[1]) + 0.0722 * linearChannel(colour[2])
  );
};

export const colourSaturation = (value: string): number | null => {
  const colour = rgb(value);
  if (!colour) return null;
  const channels = colour.map((channel) => channel / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
};
