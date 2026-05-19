import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException("Email is already registered.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash: await argon2.hash(dto.password),
        categories: {
          create: [
            { name: "Work", color: "#007AFF", icon: "briefcase" },
            { name: "Personal", color: "#FF2D55", icon: "heart" },
            { name: "Health", color: "#34C759", icon: "activity" },
          ],
        },
      },
      select: { id: true, email: true, name: true, timezone: true },
    });

    return { user, accessToken: await this.sign(user.id, user.email) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
      },
      accessToken: await this.sign(user.id, user.email),
    };
  }

  logout(userId: string) {
    // JWT logout is usually handled client-side by deleting the token.
    // In production, add a token allowlist/denylist or use rotating refresh tokens.
    return { ok: true, userId };
  }

  private sign(sub: string, email: string) {
    return this.jwt.signAsync(
      { sub, email },
      {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
        expiresIn:
          this.config.get<JwtSignOptions["expiresIn"]>("JWT_EXPIRES_IN") ?? "7d",
      },
    );
  }
}
