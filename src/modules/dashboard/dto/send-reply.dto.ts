import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendReplyDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(4096)
  message: string;
}

export class ReplyResponseDto {
  id: string;
  direction: 'OUTBOUND';
  content: string;
  createdAt: string;
  handledBy: 'HUMAN';
}
