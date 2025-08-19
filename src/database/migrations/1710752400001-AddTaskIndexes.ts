import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskIndexes1710752400001 implements MigrationInterface {
  name = 'AddTaskIndexes1710752400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_due_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_priority`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_user_id`);
  }
}
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskIndexes1710752400001 implements MigrationInterface {
  name = 'AddTaskIndexes1710752400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_due_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_priority`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_user_id`);
  }
}
