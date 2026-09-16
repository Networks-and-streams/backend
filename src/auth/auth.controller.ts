import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CookieService } from './services/cookie.service';
import { AuthMapper } from './mapper/auth.mapper';

import { LocalGuard } from './guards/local.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

import { JwtUserDto } from './dto/jwt-user.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { StatusResponseDto } from './dto/status-response.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

import type { JwtUser, RefreshJwtPayload } from '@/common/types/jwt-payload.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
    private readonly authMapper: AuthMapper,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with the provided email and password. ' +
      'On success, returns an access token in the response body and sets ' +
      'a refresh token as an HttpOnly cookie. The refresh token is used to ' +
      'obtain new access tokens via the /auth/refresh endpoint.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: 'User registered successfully' })
  @ApiBadRequestResponse({ description: 'Validation error or email already exists' })
  async register(@Res({ passthrough: true }) res: Response, @Req() req: Request, @Body() dto: RegisterDto) {
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { accessToken, refreshToken } = await this.authService.register(dto, meta);

    this.cookieService.setRefreshToken(res, refreshToken);

    return new AuthTokensResponseDto(accessToken);
  }

  @Public()
  @UseGuards(LocalGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates the user with email and password credentials. ' +
      'On success, returns an access token in the response body and sets ' +
      'a refresh token as an HttpOnly cookie.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: 'User logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @HttpCode(200)
  async login(@Res({ passthrough: true }) res: Response, @Req() req: Request, @CurrentUser() user: JwtUser) {
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { accessToken, refreshToken } = await this.authService.login(user, meta);

    this.cookieService.setRefreshToken(res, refreshToken);

    return new AuthTokensResponseDto(accessToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Logs out the user from the current session by invalidating the ' +
      'refresh token and clearing the refresh token cookie. ' +
      'Requires a valid access token in the Authorization header.',
  })
  @ApiOkResponse({ type: StatusResponseDto, description: 'User logged out successfully' })
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const refreshToken = req.cookies?.['refreshToken'] as string | undefined;
    await this.authService.logout(refreshToken);

    this.cookieService.clearRefreshToken(res);

    return new StatusResponseDto('Successfully logged out.');
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generates a new access token and refresh token using the current ' +
      'refresh token from the HttpOnly cookie. The old refresh token is ' +
      'invalidated (token rotation). The new refresh token is set as an ' +
      'HttpOnly cookie. No Authorization header is required — authentication ' +
      'is performed via the refresh token cookie.',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: 'Tokens refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Refresh token missing, expired, or invalid' })
  @HttpCode(200)
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @CurrentUser() payload: RefreshJwtPayload,
  ) {
    const oldRefreshToken = req.cookies?.['refreshToken'] as string | undefined;
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { accessToken, refreshToken } = await this.authService.refresh(payload, oldRefreshToken, meta);

    this.cookieService.setRefreshToken(res, refreshToken);

    return new AuthTokensResponseDto(accessToken);
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout from all devices',
    description:
      'Invalidates all active sessions for the authenticated user across ' +
      'all devices. Clears the refresh token cookie for the current device. ' +
      'Requires a valid access token in the Authorization header.',
  })
  @ApiOkResponse({ type: StatusResponseDto, description: 'Successfully logged out from all devices' })
  async logoutAllDevices(@Res({ passthrough: true }) res: Response, @CurrentUser() user: JwtUser) {
    this.cookieService.clearRefreshToken(res);

    await this.authService.logoutAllDevices(user.id);
    return new StatusResponseDto('Successfully logged out from all devices.');
  }

  @Get('status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user status',
    description:
      "Returns the authenticated user's profile information (id and email). " +
      'Requires a valid access token in the Authorization header.',
  })
  @ApiOkResponse({ description: 'Returns current user information', type: JwtUserDto })
  @HttpCode(200)
  getStatus(@CurrentUser() user: JwtUser) {
    return this.authMapper.toStatusResponse(user);
  }
}
