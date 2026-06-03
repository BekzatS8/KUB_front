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

export function TaskTable({ tasks, onEditTask, onTaskDeleted, onTaskUpdated }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-6 py-3">Название</TableHead>
          <TableHead className="px-6 py-3">Описание</TableHead>
          <TableHead className="px-6 py-3">Срок выполнения</TableHead>
          <TableHead className="px-6 py-3">Приоритет</TableHead>
          <TableHead className="px-6 py-3">Статус</TableHead>
          <TableHead className="px-6 py-3 text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="p-4">{task.title}</TableCell>
            <TableCell className="p-4">{task.description}</TableCell>
            <TableCell className="p-4">{new Date(task.due_date).toLocaleDateString()}</TableCell>
            <TableCell className="p-4">
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
            <TableCell className="p-4">
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
            <TableCell className="p-4 text-right">
              <TaskActions
                task={task}
                onTaskDeleted={onTaskDeleted}
                onTaskUpdated={onTaskUpdated}
                onEditTask={() => onEditTask(task)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
