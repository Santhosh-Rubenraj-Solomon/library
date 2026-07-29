import { Entity, PrimaryGeneratedColumn, CreateDateColumn, Column } from "typeorm";

/**
 * A spot in the waitlist for a book that's currently on loan.
 * Lifecycle: waiting → ready (front of queue once the book is returned)
 *            → fulfilled (that person borrowed it) | cancelled.
 * Queue order is by createdAt among {waiting, ready}.
 */
@Entity()
export class Reservation {
  @PrimaryGeneratedColumn("uuid")
  reservationId: string;

  @Column()
  bookName: string;

  @Column()
  userId: string;

  @Column()
  mailId: string;

  @Column({ default: "waiting" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
