import {Entity,PrimaryGeneratedColumn,CreateDateColumn,Column} from "typeorm"


@Entity()
export class Lend {
  @PrimaryGeneratedColumn("uuid")
  lendId: string;

  @Column()
  userId: string;
  
  @Column()
  bookName: string;
  
  @Column()
  mailId:string

  @Column({type: 'timestamp'})
  lendDate: Date;

  @Column({default: null, type: 'timestamp'})
  returnDate: Date;

  @Column({default:false})
  returned:boolean;
}

