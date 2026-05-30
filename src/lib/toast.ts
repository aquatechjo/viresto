import { toast } from 'sonner'

export const appToast = {
  success(message = 'تمت العملية بنجاح') {
    toast.success(message)
  },

  error(message = 'حدث خطأ غير متوقع') {
    toast.error(message)
  },

  loading(message = 'جاري التنفيذ...') {
    return toast.loading(message)
  },

  dismiss(id?: string | number) {
    toast.dismiss(id)
  },
}