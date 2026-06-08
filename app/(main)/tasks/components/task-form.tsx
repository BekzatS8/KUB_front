"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { CustomSelect } from "@/components/ui/custom-select"

// ─── Types ───────────────────────────────────────────────────────

interface TaskFormData {
  title: string
  description: string
  entity_id: string | number
  entity_type: string
  assignee_id: string | number
  due_date: string
  priority: string
}

interface Task {
  id?: number
  title: string
  description: string
  entity_id: number | string
  entity_type: string
  assignee_id: number | string
  due_date: string
  priority: string
}

interface TaskFormProps {
  onSubmit: (data: TaskFormData) => void
  task?: Task | null
}

// ─── Component ───────────────────────────────────────────────────

export function TaskForm({ onSubmit, task }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    entity_id: "",
    entity_type: "",
    assignee_id: "",
    due_date: "",
    priority: "medium",
  })

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        entity_id: task.entity_id || "",
        entity_type: task.entity_type || "",
        assignee_id: task.assignee_id || "",
        due_date: task.due_date || "",
        priority: task.priority || "medium",
      })
    }
  }, [task])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePriorityChange = (value: string) => {
    setFormData((prev) => ({ ...prev, priority: value }))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        name="title"
        placeholder="Введите название задачи..."
        value={formData.title}
        onChange={handleChange}
        required
      />
      <Textarea
        name="description"
        placeholder="Напишите описание..."
        value={formData.description}
        onChange={handleChange}
      />
      <Input
        name="entity_id"
        type="number"
        placeholder="Введите ID сущности..."
        value={formData.entity_id}
        onChange={handleChange}
      />
      <Input
        name="entity_type"
        placeholder="Введите тип сущности (например, deal)..."
        value={formData.entity_type}
        onChange={handleChange}
      />
      <Input
        name="assignee_id"
        type="number"
        placeholder="Введите ID ответственного..."
        value={formData.assignee_id}
        onChange={handleChange}
      />
      <DateInput
        id="due_date"
        mode="datetime"
        value={formData.due_date}
        onChange={(value) => setFormData((prev) => ({ ...prev, due_date: value }))}
      />
      <CustomSelect
        value={formData.priority}
        onChange={handlePriorityChange}
        placeholder="Выберите приоритет..."
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
      />
      <Button type="submit">{task ? "Update Task" : "Create Task"}</Button>
    </form>
  )
}
