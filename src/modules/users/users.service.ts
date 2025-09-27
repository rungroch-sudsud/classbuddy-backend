import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

    async create(
        data: { phone: string; passwordHash: string }
    ) {
        const user = new this.userModel(data);
        return user.save();
    }


    async findByPhone(phone: string) {
        return this.userModel.findOne({ phone }).exec();
    }


    // async validatePassword(
    //     phone: string,
    //     password: string
    // ): Promise<User | null> {
    //     const user = await this.findByPhone(phone);
    //     if (user && (await bcrypt.compare(password, user.password))) {
    //         return user;
    //     }
    //     return null;
    // }
}
