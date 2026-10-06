export const stufen = ['7-8', '11'] as const;
export type StufeId = (typeof stufen)[number];
