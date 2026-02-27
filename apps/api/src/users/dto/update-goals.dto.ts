import { IsNumber, IsInt, Min, Max } from 'class-validator';

export class UpdateGoalsDto {
  @IsInt()
  @Min(0)
  @Max(168)
  productive: number;

  @IsInt()
  @Min(0)
  @Max(168)
  leisure: number;

  @IsInt()
  @Min(0)
  @Max(168)
  restoration: number;

  @IsInt()
  @Min(0)
  @Max(168)
  neutral: number;
}