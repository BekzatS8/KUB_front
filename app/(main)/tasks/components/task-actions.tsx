"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  assign_task,
  change_task_status,
  complete_task,
  delete_task,
  remind_later,
} from "@/src/api/tasks.api"
import type { Task } from "@/src/models/tasks.model"
import { MoreHorizontal } from "lucide-react"

type TaskActionsProps = {
  task: Task
  onTaskDeleted: (taskId: number) => void
  onTaskUpdated: () => void
  onEditTask: (task: Task) => void
}

export function TaskActions({ task, onTaskDeleted, onTaskUpdated, onEditTask }: TaskActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isRemindDialogOpen, setIsRemindDialogOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState("")
  const [status, setStatus] = useState("")

  const handleDelete = async () => {
    try {
      await delete_task(undefined, { id: task.id })
      onTaskDeleted(task.id)
    } catch (error) {
      console.error("Failed to delete task", error)
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const handleAssign = async () => {
    try {
      await assign_task({ assignee_id: parseInt(assigneeId, 10) }, { id: task.id })
      onTaskUpdated()
    } catch (error) {
      console.error("Failed to assign task", error)
    } finally {
      setIsAssignDialogOpen(false)
    }
  }

  const handleChangeStatus = async () => {
    try {
      await change_task_status({ to: status }, { id: task.id })
      onTaskUpdated()
    } catch (error) {
      console.error("Failed to change task status", error)
    } finally {
      setIsStatusDialogOpen(false)
    }
  }

  const handleComplete = async () => {
    try {
      await complete_task(undefined, { id: task.id })
      onTaskUpdated()
    } catch (error) {
      console.error("Failed to complete task", error)
    } finally {
      setIsCompleteDialogOpen(false);
    }
  }

  const handleRemindLater = async () => {
    try {
      await remind_later(undefined, { id: task.id })
      onTaskUpdated()
    } catch (error) {
      console.error("Failed to remind later", error)
    } finally {
      setIsRemindDialogOpen(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Открыть меню</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditTask(task)}>
            Редактировать
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)}>
            Удалить
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsAssignDialogOpen(true)}>
            Назначить
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsStatusDialogOpen(true)}>
            Изменить статус
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsCompleteDialogOpen(true)}>Завершить</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsRemindDialogOpen(true)}>
            Напомнить позже
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя будет отменить. Задача будет удалена
              навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Task Dialog */}
      <AlertDialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Назначить задачу</AlertDialogTitle>
            <input
              type="text"
              placeholder="ID исполнителя"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-2 p-2 border rounded"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign}>Назначить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Status Dialog */}
      <AlertDialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить статус задачи</AlertDialogTitle>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-2 p-2 border rounded">
              <option value="">Выберите статус</option>
              <option value="new">Новая</option>
              <option value="in_progress">В процессе</option>
              <option value="done">Выполнена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeStatus}>
              Изменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Complete Task Confirmation Dialog */}
      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Завершить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отметить эту задачу как выполненную?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>Завершить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remind Later Confirmation Dialog */}
      <AlertDialog open={isRemindDialogOpen} onOpenChange={setIsRemindDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Напомнить позже?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы хотите отложить напоминание по этой задаче?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemindLater}>Да, напомнить позже</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
