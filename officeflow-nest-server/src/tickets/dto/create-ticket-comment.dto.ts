import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength} from "class-validator";

export class CreateTicketCommentDto {
    @ApiProperty({
        example: 'I have checked the VPN configuration and reset your profile',
    })
    @IsString()
    @MinLength(10)
    content!: string;
}