// FILE: apps/api/src/schedule-templates/dto/schedule-template.dto.ts

import { IsString, IsArray, IsInt, IsBoolean, IsOptional,
         ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateBlockDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsInt() @Min(0) @Max(23)
  startHour: number;

  @IsInt() @Min(0) @Max(59)
  startMinute: number;

  @IsInt() @Min(0) @Max(23)
  endHour: number;

  @IsInt() @Min(0) @Max(59)
  endMinute: number;

  @IsInt() @IsOptional()
  order?: number;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsArray() @IsInt({ each: true })
  daysOfWeek: number[];

  @IsBoolean() @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  blocks: TemplateBlockDto[];
}

export class UpdateTemplateDto {
  @IsString() @IsOptional()
  name?: string;

  @IsArray() @IsOptional()
  daysOfWeek?: number[];

  @IsBoolean() @IsOptional()
  isActive?: boolean;

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  blocks?: TemplateBlockDto[];
}

export class ConfirmGhostDto {
  @IsString() @IsOptional()
  title?: string;

  @IsString() @IsOptional()
  category?: string;

  @IsString() @IsOptional()
  startTime?: string;   // ISO string

  @IsString() @IsOptional()
  endTime?: string;     // ISO string
}