import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';

import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt.payload';
import { LoginResponse } from './interfaces/login-response';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {


  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private jwtService: JwtService
  ) { }

  async create(CreateUserDto: CreateUserDto): Promise<User> {
    try {
      const { password, ...userData } = CreateUserDto;
      const newUser = new this.userModel({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });
      await newUser.save();

      // Remove password from response
      const { password: _, ...user } = newUser.toJSON();
      return user;

    } catch (error) {

      if (error.code === 11000) {
        throw new BadRequestException(`Email ${CreateUserDto.email} already exists`);
      }
      throw new InternalServerErrorException(`Error creating user: ${error}`);

    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException(`User with email ${email} not found`);
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new BadRequestException('Wrong password');
    }

    const { password: _, ...result } = user.toJSON();
    return {
      user: result,
      token: this.getJWT({ id: user.id })
    }
  }

  async register(registerUserDto: RegisterUserDto): Promise<LoginResponse> {

    const user = await this.create(registerUserDto);
    return {
      user,
      token: this.getJWT({ id: user._id })
    }
  }

  getJWT(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }
}
