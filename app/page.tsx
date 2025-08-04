"use client"

import type React from "react"

import { useState } from "react"
import { Menu, X, Calendar, Upload, Download, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"

export default function SPAApp() {
  const [activeSection, setActiveSection] = useState("schedule")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [schedule, setSchedule] = useState<{ date: string; names: string[] }[]>([])
  const [fileError, setFileError] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [canReshuffle, setCanReshuffle] = useState(false)
  const [namesPerFriday, setNamesPerFriday] = useState<number>(3)
  const [unusedNames, setUnusedNames] = useState<string[]>([])

  const navigation = [{ id: "schedule", name: "Horario", icon: Calendar }]

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    setMobileMenuOpen(false)
    const element = document.getElementById(sectionId)
    element?.scrollIntoView({ behavior: "smooth" })
  }

  const getNextFriday = (date: Date): Date => {
    const nextFriday = new Date(date)
    const daysUntilFriday = (5 - date.getDay() + 7) % 7
    if (daysUntilFriday === 0 && date.getDay() === 5) {
      nextFriday.setDate(date.getDate() + 7)
    } else {
      nextFriday.setDate(date.getDate() + (daysUntilFriday || 7))
    }
    return nextFriday
  }

  const getAllFridaysInYear = (startDate: Date): Date[] => {
    const fridays: Date[] = []
    const currentYear = startDate.getFullYear()
    const currentFriday = getNextFriday(startDate)

    while (currentFriday.getFullYear() === currentYear) {
      fridays.push(new Date(currentFriday))
      currentFriday.setDate(currentFriday.getDate() + 7)
    }

    return fridays
  }

  const assignNamesToFridays = (namesList: string[]): { date: string; names: string[]; unusedNames: string[] } => {
    if (namesList.length === 0) return { schedule: [], unusedNames: [] }

    // Shuffle the names randomly before assignment
    const shuffledNames = [...namesList].sort(() => Math.random() - 0.5)

    const today = new Date()
    const fridays = getAllFridaysInYear(today)
    const assignments: { date: string; names: string[] }[] = []

    let nameIndex = 0

    for (const friday of fridays) {
      const selectedNames: string[] = []

      // Try to assign the specified number of names for this Friday
      for (let i = 0; i < namesPerFriday; i++) {
        if (nameIndex < shuffledNames.length) {
          selectedNames.push(shuffledNames[nameIndex])
          nameIndex++
        } else {
          // Not enough names to fulfill the requirement
          break
        }
      }

      // Only add the assignment if we have the exact number of names required
      if (selectedNames.length === namesPerFriday) {
        assignments.push({
          date: friday.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          names: selectedNames,
        })
      } else {
        // Stop scheduling if we can't fulfill the requirement
        break
      }
    }

    // Return unused names
    const remainingNames = shuffledNames.slice(nameIndex)

    return { schedule: assignments, unusedNames: remainingNames }
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    setFileError("")

    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase()

      if (!fileExtension || !["xls", "xlsx", "csv"].includes(fileExtension)) {
        throw new Error("Formato de archivo inválido. Por favor sube solo archivos XLS, XLSX o CSV.")
      }

      let extractedNames: string[] = []

      if (fileExtension === "csv") {
        const text = await file.text()
        const lines = text.split("\n").filter((line) => line.trim())

        extractedNames = lines
          .map((line) => {
            const firstColumn = line.split(",")[0]?.trim()
            return firstColumn?.replace(/"/g, "") || ""
          })
          .filter((name) => name.length > 0)
      } else if (fileExtension === "xls" || fileExtension === "xlsx") {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][]

        extractedNames = jsonData.map((row) => row[0]?.toString().trim()).filter((name) => name && name.length > 0)
      }

      if (extractedNames.length === 0) {
        throw new Error("No se encontraron nombres en la primera columna del archivo.")
      }

      setNames(extractedNames)
      const result = assignNamesToFridays(extractedNames)
      setSchedule(result.schedule)
      setUnusedNames(result.unusedNames)
      setCanReshuffle(true)
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Ocurrió un error al procesar el archivo.")
      setNames([])
      setSchedule([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const downloadSchedule = () => {
    if (schedule.length === 0) return

    // Create dynamic headers
    const headers = ["Fecha"]
    for (let i = 1; i <= namesPerFriday; i++) {
      headers.push(`Nombre ${i}`)
    }

    const csvContent =
      headers.join(",") +
      "\n" +
      schedule
        .map((item) => {
          const row = [`"${item.date}"`]
          for (let i = 0; i < namesPerFriday; i++) {
            row.push(`"${item.names[i] || ""}"`)
          }
          return row.join(",")
        })
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "horario-viernes.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportToPDF = () => {
    if (schedule.length === 0) return

    // Create a simple HTML content for PDF
    const htmlContent = `
    <html>
      <head>
        <title>Horario de Viernes</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; text-align: center; }
          .schedule-item { 
            border: 1px solid #ddd; 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 5px; 
            background-color: #f9f9f9;
          }
          .date { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
          .names { display: flex; gap: 10px; flex-wrap: wrap; }
          .name-badge { 
            background-color: #e2e8f0; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <h1>Asignación de Desayunitos</h1>
        <p><strong>Total de Viernes Programados:</strong> ${schedule.length}</p>
        ${schedule
          .map(
            (item) => `
          <div class="schedule-item">
            <div class="date">${item.date}</div>
            <div class="names">
              ${item.names.map((name) => `<span class="name-badge">${name}</span>`).join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </body>
    </html>
  `

    // Create blob and download
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "horario-viernes.html"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">Asignaciones</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                        activeSection === item.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-background border-t">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="h-screen">
        {/* Schedule Section */}
        <section id="schedule" className="py-20 bg-muted/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Asignación de desayunitos</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Sube un archivo CSV o XLS con nombres para generar un horario de asignación de viernes
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-8">
              {/* File Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Subir archivo de nombres
                  </CardTitle>
                  <CardDescription>
                    Sube un archivo CSV o XLS con nombres en la primera columna. La aplicación asignará 3 nombres
                    aleatorios a cada viernes del año.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label
                      htmlFor="file-upload"
                      className={`cursor-pointer flex flex-col items-center gap-4 ${
                        isProcessing ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-medium">
                          {isProcessing ? "Procesando..." : "Haz clic para subir archivo"}
                        </p>
                        <p className="text-sm text-muted-foreground">Compatible con archivos CSV, XLS y XLSX</p>
                      </div>
                    </label>
                  </div>

                  {fileError && (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <p className="text-destructive">{fileError}</p>
                    </div>
                  )}

                  {names.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium">✅ Se cargaron exitosamente {names.length} nombres</p>
                      <p className="text-sm text-green-600 mt-1">
                        Configuración actual: {namesPerFriday} nombres por viernes
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {names.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Configuración de Asignación</CardTitle>
                    <CardDescription>Especifica cuántos nombres quieres asignar a cada viernes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label htmlFor="names-per-friday" className="text-sm font-medium">
                        Nombres por viernes:
                      </label>
                      <input
                        id="names-per-friday"
                        type="number"
                        min="1"
                        max="10"
                        value={namesPerFriday}
                        onChange={(e) => setNamesPerFriday(Number.parseInt(e.target.value) || 3)}
                        className="w-20 px-3 py-2 border border-input rounded-md text-sm"
                      />
                      <Button
                        onClick={() => {
                          const result = assignNamesToFridays(names)
                          setSchedule(result.schedule)
                          setUnusedNames(result.unusedNames)
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Aplicar
                      </Button>
                    </div>

                    {unusedNames.length > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 font-medium">⚠️ Nombres no utilizados ({unusedNames.length}):</p>
                        <p className="text-sm text-yellow-700 mt-1">{unusedNames.join(", ")}</p>
                        <p className="text-xs text-yellow-600 mt-2">
                          Estos nombres no pudieron ser asignados porque no hay suficientes para completar un viernes
                          con {namesPerFriday} nombres.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* How it works - Now attached to upload section */}
              <Card>
                <CardHeader>
                  <CardTitle>Cómo funciona</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <p className="text-sm">Sube un archivo CSV o XLS con nombres en la primera columna</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <p className="text-sm">La aplicación extrae todos los nombres de la primera columna</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <p className="text-sm">
                      Los nombres se mezclan aleatoriamente y luego se asigna la cantidad especificada de nombres a cada
                      viernes comenzando desde el próximo viernes. ¡Puedes mezclar en cualquier momento!
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <p className="text-sm">
                      Las asignaciones continúan hasta que se usen todos los nombres (sin repetición)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Results Section - New title added */}
              {schedule.length > 0 && (
                <>
                  <div className="text-center py-8">
                    <h3 className="text-2xl md:text-3xl font-bold text-primary">Resultados de la Asignación</h3>
                    <p className="text-muted-foreground mt-2">
                      Aquí está tu horario generado. Puedes mezclarlo nuevamente o exportarlo.
                    </p>
                  </div>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Horario de Asignación de Viernes
                        </CardTitle>
                        <CardDescription>{schedule.length} viernes programados para este año</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {canReshuffle && (
                          <Button
                            onClick={() => {
                              const result = assignNamesToFridays(names)
                              setSchedule(result.schedule)
                              setUnusedNames(result.unusedNames)
                            }}
                            variant="outline"
                            className="flex items-center gap-2 bg-transparent"
                          >
                            <Calendar className="h-4 w-4" />
                            Mezclar
                          </Button>
                        )}
                        <div className="relative">
                          <Button
                            variant="outline"
                            className="flex items-center gap-2 bg-transparent"
                            onClick={() => document.getElementById("export-menu")?.classList.toggle("hidden")}
                          >
                            <Download className="h-4 w-4" />
                            Exportar
                          </Button>
                          <div
                            id="export-menu"
                            className="hidden absolute right-0 mt-2 w-48 bg-background border border-border rounded-md shadow-lg z-10"
                          >
                            <div className="py-1">
                              <button
                                onClick={downloadSchedule}
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-muted"
                              >
                                Exportar como CSV
                              </button>
                              <button
                                onClick={exportToPDF}
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-muted"
                              >
                                Exportar como HTML
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {schedule.map((item, index) => (
                          <div
                            key={index}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/50 rounded-lg"
                          >
                            <div className="font-medium text-sm sm:text-base mb-2 sm:mb-0">{item.date}</div>
                            <div className="flex flex-wrap gap-2">
                              {item.names.map((name, nameIndex) => (
                                <Badge key={nameIndex} variant="secondary">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  {/* Unused Names Table */}
                  {unusedNames.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-700">
                          <AlertCircle className="h-5 w-5" />
                          Nombres No Utilizados
                        </CardTitle>
                        <CardDescription>
                          Los siguientes nombres no pudieron ser asignados porque no hay suficientes para completar un
                          viernes con {namesPerFriday} nombres.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-4 font-medium">#</th>
                                <th className="text-left py-2 px-4 font-medium">Nombre</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unusedNames.map((name, index) => (
                                <tr key={index} className="border-b hover:bg-muted/50">
                                  <td className="py-2 px-4 text-sm text-muted-foreground">{index + 1}</td>
                                  <td className="py-2 px-4">{name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-700">
                            <strong>Total de nombres no utilizados:</strong> {unusedNames.length}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
