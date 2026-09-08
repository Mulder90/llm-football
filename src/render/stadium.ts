import { PITCH_LAYOUT, STADIUM_SIZE } from './layout.ts';
import { drawPixelRect } from './pixels.ts';
import {
  decorationNoise,
  drawStadiumAtmosphere,
  drawSupporterStands,
  drawTreeBases,
} from './stadium-atmosphere.ts';
export { drawCrowd } from './stadium-atmosphere.ts';

const FIELD_MARKINGS = {
  centerCircleRadiusMetres: 9.15,
  penaltyAreaDepthMetres: 16.5,
  penaltyAreaWidthMetres: 40.32,
  goalAreaDepthMetres: 5.5,
  goalAreaWidthMetres: 18.32,
  penaltySpotDistanceMetres: 11,
  penaltyArcHalfAngleRadians: 0.925,
} as const;
const MOWING_STRIPE_COUNT = 14;

function drawConcourseAndStands(context: CanvasRenderingContext2D): void {
  drawPixelRect(context, 0, 0, STADIUM_SIZE.width, STADIUM_SIZE.height, '#10202a');
  // Paved concourse, block seams, planted corners and four stands.
  for (let y = 0; y < STADIUM_SIZE.height; y += 12)
    for (let x = 0; x < STADIUM_SIZE.width; x += 16) {
      drawPixelRect(
        context,
        x + 1,
        y + 1,
        15,
        11,
        decorationNoise(x, y) > 0.5 ? '#263c43' : '#2b4147',
      );
    }
  drawSupporterStands(context);
  drawTreeBases(context);
  // Stadium bowl and ad boards.
  drawPixelRect(context, 74, 68, 812, 519, '#081720');
  drawPixelRect(context, 82, 74, 796, 506, '#39724c');
  for (let x = 100; x < 870; x += 70) {
    drawPixelRect(context, x, 69, 66, 6, Math.floor(x / 70) % 2 ? '#ce6459' : '#70b8b5');
    drawPixelRect(context, x, 582, 66, 6, Math.floor(x / 70) % 2 ? '#70b8b5' : '#ce6459');
  }
}

function drawPitch(context: CanvasRenderingContext2D): void {
  const {
    left: pitchLeft,
    top: pitchTop,
    width: pitchWidth,
    height: pitchHeight,
    pixelsPerMetre,
  } = PITCH_LAYOUT;
  drawPixelRect(context, pitchLeft, pitchTop, pitchWidth, pitchHeight, '#3d8553');
  for (let stripe = 0; stripe < MOWING_STRIPE_COUNT; stripe++)
    drawPixelRect(
      context,
      pitchLeft + (stripe * pitchWidth) / MOWING_STRIPE_COUNT,
      pitchTop,
      pitchWidth / MOWING_STRIPE_COUNT,
      pitchHeight,
      stripe % 2 ? '#438c56' : '#3e8552',
    );
  for (let grassY = pitchTop + 2; grassY < pitchTop + pitchHeight - 2; grassY += 4)
    for (let grassX = pitchLeft + 2; grassX < pitchLeft + pitchWidth - 2; grassX += 4) {
      const textureValue = decorationNoise(grassX, grassY);
      if (textureValue > 0.65)
        drawPixelRect(
          context,
          grassX,
          grassY,
          textureValue > 0.95 ? 2 : 1,
          1,
          textureValue > 0.86 ? '#579763' : '#377e4d',
        );
    }
  context.strokeStyle = '#c1d5a4';
  context.lineWidth = 1.5;
  context.strokeRect(pitchLeft + 0.5, pitchTop + 0.5, pitchWidth, pitchHeight);
  context.beginPath();
  context.moveTo(pitchLeft + pitchWidth / 2, pitchTop);
  context.lineTo(pitchLeft + pitchWidth / 2, pitchTop + pitchHeight);
  context.stroke();
  context.beginPath();
  context.arc(
    pitchLeft + pitchWidth / 2,
    pitchTop + pitchHeight / 2,
    FIELD_MARKINGS.centerCircleRadiusMetres * pixelsPerMetre,
    0,
    Math.PI * 2,
  );
  context.stroke();
  for (const left of [true, false]) {
    const goalLineX = left ? pitchLeft : pitchLeft + pitchWidth,
      sign = left ? 1 : -1;
    context.strokeRect(
      goalLineX,
      pitchTop + pitchHeight / 2 - (FIELD_MARKINGS.penaltyAreaWidthMetres / 2) * pixelsPerMetre,
      sign * FIELD_MARKINGS.penaltyAreaDepthMetres * pixelsPerMetre,
      FIELD_MARKINGS.penaltyAreaWidthMetres * pixelsPerMetre,
    );
    context.strokeRect(
      goalLineX,
      pitchTop + pitchHeight / 2 - (FIELD_MARKINGS.goalAreaWidthMetres / 2) * pixelsPerMetre,
      sign * FIELD_MARKINGS.goalAreaDepthMetres * pixelsPerMetre,
      FIELD_MARKINGS.goalAreaWidthMetres * pixelsPerMetre,
    );
    context.beginPath();
    context.arc(
      goalLineX + sign * FIELD_MARKINGS.penaltySpotDistanceMetres * pixelsPerMetre,
      pitchTop + pitchHeight / 2,
      FIELD_MARKINGS.centerCircleRadiusMetres * pixelsPerMetre,
      left
        ? -FIELD_MARKINGS.penaltyArcHalfAngleRadians
        : Math.PI - FIELD_MARKINGS.penaltyArcHalfAngleRadians,
      left
        ? FIELD_MARKINGS.penaltyArcHalfAngleRadians
        : Math.PI + FIELD_MARKINGS.penaltyArcHalfAngleRadians,
    );
    context.stroke();
    drawPixelRect(
      context,
      goalLineX + sign * FIELD_MARKINGS.penaltySpotDistanceMetres * pixelsPerMetre - 1,
      pitchTop + pitchHeight / 2 - 1,
      3,
      3,
      '#dce4bb',
    );
    // Goal net: flat orthographic geometry behind the goal line.
    const netLeft = left ? pitchLeft - 19 : pitchLeft + pitchWidth;
    drawPixelRect(context, netLeft, pitchTop + pitchHeight / 2 - 26, 19, 53, '#c1d7cf');
    drawPixelRect(context, netLeft + 2, pitchTop + pitchHeight / 2 - 24, 15, 49, '#253d43');
    for (
      let netRow = pitchTop + pitchHeight / 2 - 23;
      netRow < pitchTop + pitchHeight / 2 + 26;
      netRow += 5
    )
      drawPixelRect(context, netLeft + 2, netRow, 15, 1, '#6d8e86');
    for (let netColumn = netLeft + 3; netColumn < netLeft + 17; netColumn += 4)
      drawPixelRect(context, netColumn, pitchTop + pitchHeight / 2 - 24, 1, 49, '#6d8e86');
    drawPixelRect(context, goalLineX - 1, pitchTop + pitchHeight / 2 - 27, 3, 55, '#f4ecd2');
  }
  drawPixelRect(
    context,
    pitchLeft + pitchWidth / 2 - 1,
    pitchTop + pitchHeight / 2 - 1,
    3,
    3,
    '#e3e7be',
  );
  for (const [cornerX, cornerY] of [
    [pitchLeft, pitchTop],
    [pitchLeft + pitchWidth, pitchTop],
    [pitchLeft, pitchTop + pitchHeight],
    [pitchLeft + pitchWidth, pitchTop + pitchHeight],
  ]) {
    const flagX = cornerX!,
      flagY = cornerY!;
    drawPixelRect(context, flagX, flagY - 8, 1, 9, '#e4e8c9');
    drawPixelRect(context, flagX + 1, flagY - 8, 5, 4, '#f9c24b');
  }
}

function drawDugoutsAndLights(context: CanvasRenderingContext2D): void {
  // Dugouts and tunnel, kept out of the pitch.
  for (const dugoutX of [305, 560]) {
    drawPixelRect(context, dugoutX, 572, 96, 22, '#0a202a');
    drawPixelRect(context, dugoutX, 572, 96, 3, '#6f9caa');
    for (let i = 0; i < 7; i++) {
      drawPixelRect(
        context,
        dugoutX + 8 + i * 12,
        580,
        7,
        9,
        dugoutX < 400 ? '#bd665b' : '#5aafba',
      );
    }
    drawPixelRect(context, dugoutX, 593, 96, 2, '#779692');
  }
  drawPixelRect(context, 450, 572, 60, 81, '#09171f');
  for (let i = 0; i < 8; i++) drawPixelRect(context, 450, 595 + i * 7, 60, 1, '#29414a');
  // Warm floodlights, deliberately pixel clusters instead of a full-canvas glow.
  for (const [lightX, lightY] of [
    [86, 52],
    [863, 52],
    [86, 610],
    [863, 610],
  ]) {
    drawPixelRect(context, lightX! - 13, lightY! - 10, 31, 23, '#172734');
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 3; i++) {
        drawPixelRect(context, lightX! - 10 + i * 9, lightY! - 7 + j * 9, 7, 7, '#e2d4a8');
        drawPixelRect(context, lightX! - 9 + i * 9, lightY! - 6 + j * 9, 5, 5, '#fff4ca');
      }
  }
}

export function createStadium(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = STADIUM_SIZE.width;
  canvas.height = STADIUM_SIZE.height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  drawConcourseAndStands(context);
  drawPitch(context);
  drawDugoutsAndLights(context);
  drawStadiumAtmosphere(context);
  return canvas;
}
