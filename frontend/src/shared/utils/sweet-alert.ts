import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import './sweet-alert.css'

type ConfirmActionOptions = {
  title: string
  text: string
  confirmButtonText: string
  loadingTitle: string
  successTitle: string
  errorTitle: string
  getErrorMessage: (error: unknown) => string
  action: () => Promise<void>
}

const customClass = {
  confirmButton: 'app-swal-confirm',
  cancelButton: 'app-swal-cancel',
}

export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    customClass,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    preConfirm: async () => {
      Swal.update({ title: options.loadingTitle, text: '' })
      try {
        await options.action()
      } catch (error) {
        Swal.showValidationMessage(`${options.errorTitle}: ${options.getErrorMessage(error)}`)
      }
    },
  })

  if (!result.isConfirmed) return false

  await Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: options.successTitle,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    customClass,
  })
  return true
}
