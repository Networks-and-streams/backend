import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientInitializationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Database connection errors
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error(`Database connection error: ${exception.message}`, exception.stack);
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database is unavailable',
      });
    }

    // 2. Prisma known request errors (Known Request Errors)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          this.logger.warn(`Unique constraint violation: ${exception.message}`);
          return response.status(HttpStatus.CONFLICT).json({
            statusCode: HttpStatus.CONFLICT,
            message: 'Resource already exists',
          });

        case 'P2025': // Record not found
          this.logger.warn(`Record not found: ${exception.message}`);
          return response.status(HttpStatus.NOT_FOUND).json({
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Record not found',
          });

        case 'P2003': // Foreign key constraint failed
          this.logger.warn(`Foreign key constraint violation: ${exception.message}`);
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Foreign key constraint failed',
          });

        case 'P2000': // Value too long for column
        case 'P2006': // Provided value is not valid
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid input data provided for database operation',
          });

        default: {
          this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`, exception.stack);
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Database request error',
          });
        }
      }
    }
  }
}
