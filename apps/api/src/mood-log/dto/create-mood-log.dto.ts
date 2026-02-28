import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Mood score scale: 1–5
 * 1 = Very low  2 = Low  3 = Okay  4 = Good  5 = Great
 * Server generates date — client cannot send or spoof it.
 * One log per user per calendar day (upsert on duplicate).
 */
export class CreateMoodLogDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}