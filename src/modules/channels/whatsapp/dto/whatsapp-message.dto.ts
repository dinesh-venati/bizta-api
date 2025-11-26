import {
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WhatsAppTextDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class WhatsAppProfileDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class WhatsAppContactDto {
  @ValidateNested()
  @Type(() => WhatsAppProfileDto)
  @IsOptional()
  profile?: WhatsAppProfileDto;

  @IsString()
  @IsOptional()
  wa_id?: string;
}

export class WhatsAppMetadataDto {
  @IsString()
  @IsOptional()
  display_phone_number?: string;

  @IsString()
  @IsOptional()
  phone_number_id?: string;
}

export class WhatsAppMessageDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @ValidateNested()
  @Type(() => WhatsAppTextDto)
  @IsOptional()
  text?: WhatsAppTextDto;
}

export class WhatsAppValueDto {
  @IsString()
  @IsNotEmpty()
  messaging_product: string;

  @ValidateNested()
  @Type(() => WhatsAppMetadataDto)
  @IsOptional()
  metadata?: WhatsAppMetadataDto;

  @ValidateNested({ each: true })
  @Type(() => WhatsAppContactDto)
  @IsArray()
  @IsOptional()
  contacts?: WhatsAppContactDto[];

  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessageDto)
  @IsArray()
  @IsOptional()
  messages?: WhatsAppMessageDto[];
}

export class WhatsAppChangeDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @ValidateNested()
  @Type(() => WhatsAppValueDto)
  value: WhatsAppValueDto;
}

export class WhatsAppEntryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes: WhatsAppChangeDto[];
}

export class WhatsAppWebhookDto {
  @IsString()
  @IsNotEmpty()
  object: string;

  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry: WhatsAppEntryDto[];
}
