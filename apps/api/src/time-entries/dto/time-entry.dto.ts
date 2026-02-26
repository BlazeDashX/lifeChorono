import { IsString, IsEnum, IsOptional, IsDateString, IsUUID, IsNotEmpty } from 'class-validator';
import { Category } from '@prisma/client';

export class CreateTimeEntryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(Category)
  category: Category;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID()
  recurringTaskId?: string;
}

export class UpdateTimeEntryDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsEnum(Category) category?: Category;
  @IsOptional() @IsString() subCategory?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsString() note?: string;
}