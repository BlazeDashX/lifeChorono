import { IsString, IsEnum, IsInt, IsArray, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Category } from '@prisma/client';

export class CreateRecurringDto {
  @IsString() title: string;
  @IsEnum(Category) category: Category;
  @IsInt() @Min(1) @Max(1440) defaultDuration: number;
  @IsArray() @IsInt({ each: true }) daysOfWeek: number[]; // 0=Sun, 1=Mon, etc.
}

export class UpdateRecurringDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsInt() defaultDuration?: number;
  @IsOptional() @IsArray() daysOfWeek?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}