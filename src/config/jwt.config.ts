import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRATION || '1d',
  };
});