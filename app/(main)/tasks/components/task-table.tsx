"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TaskActions } from "./task-actions"
import type { Task } from "@/src/models/tasks.model"

type TaskTableProps = {
  tasks: Task[]
  onEditTask: (task: Task) => void
  onTaskDeleted: (taskId: number) => void
  onTaskUpdated: () => void
}

export function TaskTable({ tasks, onEditTask, onTaskDeleted, onTaskUpdated }: TaskTableProps) {
  return (
    <Table className="w-full table-fixed">
      <colgroup>
        <col className="w-[22%]" />
        <col className="w-[30%]" />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[10%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4 py-3">Название</TableHead>
          <TableHead className="px-4 py-3">Описание</TableHead>
          <TableHead className="px-4 py-3">Срок</TableHead>
          <TableHead className="px-4 py-3">Приоритет</TableHead>
          <TableHead className="px-4 py-3">Статус</TableHead>
          <TableHead className="px-4 py-3 text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              Задачи не найдены
            </TableCell>
          </TableRow>
        ) : (
          tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="p-4 align-top">
                <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {task.title}
                </div>
              </TableCell>
              <TableCell className="p-4 align-top">
                <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {task.description || "—"}
                </div>
              </TableCell>
              <TableCell className="p-4 align-top whitespace-nowrap">
                {task.due_date ? new Date(task.due_date).toLocaleDateString("ru-RU") : "—"}
              </TableCell>
              <TableCell className="p-4 align-top">
                <Badge
                  variant={
                    task.priority === "high"
                      ? "destructive"
                      : task.priority === "medium"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="p-4 align-top">
                <Badge
                  variant={
                    task.status === "done"
                      ? "default"
                      : task.status === "in_progress"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {task.status}
                </Badge>
              </TableCell>
              <TableCell className="p-4 align-top text-right">
                <TaskActions
                  task={task}
                  onTaskDeleted={onTaskDeleted}
                  onTaskUpdated={onTaskUpdated}
                  onEditTask={onEditTask}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
