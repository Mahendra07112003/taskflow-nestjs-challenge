import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    // Inefficient implementation: creates the task but doesn't use a single transaction
    // for creating and adding to queue, potential for inconsistent state
    const task = this.tasksRepository.create(createTaskDto);
    const savedTask = await this.tasksRepository.save(task);

    // Add to queue without waiting for confirmation or handling errors
    this.taskQueue.add('task-status-update', {
      taskId: savedTask.id,
      status: savedTask.status,
    });

    return savedTask;
  }

  async findAll(userId: string, filters?: {
    status?: TaskStatus;
    priority?: any;
    search?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'status';
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: Task[]; total: number; page: number; limit: number; totalPages: number }>{
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 10;
    const sortBy = filters?.sortBy ?? 'createdAt';
    const sortOrder = filters?.sortOrder ?? 'DESC';

    const qb = this.tasksRepository.createQueryBuilder('task')
      .where('task.userId = :userId', { userId });

    if (filters?.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    if (filters?.dueDateFrom) {
      qb.andWhere('task.dueDate >= :dueDateFrom', { dueDateFrom: filters.dueDateFrom });
    }

    if (filters?.dueDateTo) {
      qb.andWhere('task.dueDate <= :dueDateTo', { dueDateTo: filters.dueDateTo });
    }

    if (filters?.search) {
      qb.andWhere(new Brackets((sub) => {
        sub.where('LOWER(task.title) LIKE :q', { q: `%${filters.search.toLowerCase()}%` })
           .orWhere('LOWER(task.description) LIKE :q', { q: `%${filters.search.toLowerCase()}%` });
      }));
    }

    const sortMap: Record<string, string> = {
      createdAt: 'task.createdAt',
      dueDate: 'task.dueDate',
      priority: 'task.priority',
      status: 'task.status',
    };

    qb.orderBy(sortMap[sortBy], sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id, userId },
      relations: ['user'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    // Inefficient implementation: multiple database calls
    // and no transaction handling
    const task = await this.findOne(id, userId);

    const originalStatus = task.status;

    // Directly update each field individually
    if (updateTaskDto.title) task.title = updateTaskDto.title;
    if (updateTaskDto.description) task.description = updateTaskDto.description;
    if (updateTaskDto.status) task.status = updateTaskDto.status;
    if (updateTaskDto.priority) task.priority = updateTaskDto.priority;
    if (updateTaskDto.dueDate) task.dueDate = updateTaskDto.dueDate;

    const updatedTask = await this.tasksRepository.save(task);

    // Add to queue if status changed, but without proper error handling
    if (originalStatus !== updatedTask.status) {
      this.taskQueue.add('task-status-update', {
        taskId: updatedTask.id,
        status: updatedTask.status,
      });
    }

    return updatedTask;
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id, userId);
    await this.tasksRepository.remove(task);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    // Inefficient implementation: doesn't use proper repository patterns
    const query = 'SELECT * FROM tasks WHERE status = $1';
    return this.tasksRepository.query(query, [status]);
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    task.status = status as any;
    return this.tasksRepository.save(task);
  }

  async batchProcess(userId: string, taskIds: string[], action: 'complete' | 'delete') {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return { affected: 0 };
    }

    if (action === 'delete') {
      const result = await this.tasksRepository.delete({ id: In(taskIds), userId });
      return { affected: result.affected ?? 0 };
    }

    if (action === 'complete') {
      const result = await this.tasksRepository.createQueryBuilder()
        .update(Task)
        .set({ status: TaskStatus.COMPLETED })
        .where('user_id = :userId', { userId })
        .andWhere('id IN (:...taskIds)', { taskIds })
        .execute();
      return { affected: result.affected ?? 0 };
    }

    return { affected: 0 };
  }

  async getStats(userId: string) {
    const raw = await this.tasksRepository.createQueryBuilder('task')
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN task.status = :completed THEN 1 ELSE 0 END)`, 'completed')
      .addSelect(`SUM(CASE WHEN task.status = :inProgress THEN 1 ELSE 0 END)`, 'inProgress')
      .addSelect(`SUM(CASE WHEN task.status = :pending THEN 1 ELSE 0 END)`, 'pending')
      .addSelect(`SUM(CASE WHEN task.priority = :high THEN 1 ELSE 0 END)`, 'highPriority')
      .where('task.userId = :userId', { userId })
      .setParameters({
        completed: TaskStatus.COMPLETED,
        inProgress: TaskStatus.IN_PROGRESS,
        pending: TaskStatus.PENDING,
        high: 'HIGH',
      })
      .getRawOne();

    return {
      total: Number(raw?.total ?? 0),
      completed: Number(raw?.completed ?? 0),
      inProgress: Number(raw?.inProgress ?? 0),
      pending: Number(raw?.pending ?? 0),
      highPriority: Number(raw?.highPriority ?? 0),
    };
  }
}
