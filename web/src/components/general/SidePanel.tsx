"use client"

import React from 'react'
import { Card } from '../ui/card'
import Link from 'next/link'
import { buttonVariants } from '../ui/button'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

export const SidePanel =  ({courseId}:{courseId?:string}) => {

  return (
    <Card className='lg:flex-1 bg-card rounded-lg p-6 max-h-[30vh] md:max-h-[90vh] overflow-y-auto no-scrollbar  shadow-md'>
       <Link href={`/courses/${courseId}/quiz`} className={twMerge(buttonVariants({variant:"secondary"}),"relative overflow-hidden text-lg font-semibold")}>
            <div className='absolute inset-x-0 bottom-px h-px bg-linear-to-r from-transparent border-px via-primary to-transparent'></div>
            Quiz 
       </Link>
    </Card>
  )
}

