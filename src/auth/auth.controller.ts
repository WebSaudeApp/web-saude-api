import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar novo usuário',
    description:
      'Cria uma nova conta de usuário (PACIENTE ou GESTOR) e retorna os tokens de autenticação.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Usuário cadastrado com sucesso.',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados de requisição inválidos ou papel não permitido.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'E-mail já está em uso.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    const meta = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    return this.authService.register(dto, meta);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuário',
    description:
      'Valida as credenciais de acesso, inicia uma nova sessão e retorna os tokens de acesso e renovação.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticação realizada com sucesso.',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Credenciais inválidas.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    const meta = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    return this.authService.login(dto, meta);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar ou cadastrar com Google OAuth',
    description:
      'Valida o idToken emitido pelo Google, cria a conta (se for o primeiro acesso) ou vincula à conta existente, e retorna os tokens de autenticação da aplicação.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticação com Google realizada com sucesso.',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token do Google inválido ou conta inativa.',
  })
  async loginComGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    const meta = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    return this.authService.loginComGoogle(dto, meta);
  }
}
